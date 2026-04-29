import asyncio
import gc
import json
from typing import List, Literal, Optional, Type, TypeVar, overload

from llama_cpp import Iterator, Llama
from llama_cpp.llama_types import (
    ChatCompletionRequestMessage,
    CreateChatCompletionResponse,
    CreateChatCompletionStreamResponse,
)
from pydantic import BaseModel

from app.utils.paths import MODELS_DIR

T = TypeVar("T", bound=BaseModel)


class AgentService:
    """
    Handles the lifecycle and operations of the Small Language Models (SLM).
    Optimized for 4GB VRAM hardware with dynamic layer offloading.
    """

    def __init__(self):
        self.model: Optional[Llama] = None
        self.current_model_path: Optional[str] = None
        self._stop_event = asyncio.Event()
        self._model_lock = asyncio.Lock()

    def stop(self) -> None:
        """
        Triggers a graceful halt of any active inference.
        """
        self._stop_event.set()

    async def load(self, config: dict) -> None:
        """
        Loads an SLM model with dynamic hardware constraints.

        Args:
            config: Agent config dict from model_config.yaml, containing
                    'filename', 'layers', and 'context_size' keys.
        """
        async with self._model_lock:
            path = str(MODELS_DIR / config["filename"])
            n_gpu_layers = config["layers"]
            n_ctx = config["context_size"]

            # Bypass I/O if the model is already in VRAM
            if self.current_model_path == path and self.model is not None:
                return

            self.model = await asyncio.to_thread(
                Llama,
                model_path=path,
                n_gpu_layers=n_gpu_layers,
                n_ctx=n_ctx,
                flash_attn=True,  # Critical for Gemma 3 / Phi memory efficiency
                verbose=False,
            )

            self.current_model_path = path
            self._current_n_gpu_layers = n_gpu_layers
            print(
                f"Model loaded successfully: {path} (Layers: {n_gpu_layers}, Context: {n_ctx})"
            )

    async def unload(self) -> None:
        """
        Force-releases VRAM and synchronizes deallocation.
        """
        async with self._model_lock:
            if self.model is not None:
                self.model.close()
                del self.model
                self.model = None
                self.current_model_path = None

                # Flush Python objects and wait for CUDA driver to unmap memory
                await asyncio.to_thread(gc.collect)
                await asyncio.sleep(0.5)

    async def swap(self, config: dict) -> None:
        """
        Swaps models, only triggering unload if a different model is requested.

        Args:
            config: Agent config dict from model_config.yaml, containing
                    'filename', 'layers', and 'context_size' keys.
        """
        path = str(MODELS_DIR / config["filename"])
        if self.current_model_path == path:
            return

        await self.unload()
        await self.load(config)

    async def clear_context(self) -> None:
        """
        Purges KV cache (context memory) without unloading model weights.
        """
        async with self._model_lock:
            if self.model is not None:
                # Purge the sequence memory in llama-cpp
                await asyncio.to_thread(self.model.reset)
                print("KV Cache purged. Sequence memory cleared.")

    @overload
    async def generate(
        self,
        messages: List[ChatCompletionRequestMessage],
        temp: float,
        max_tokens: int,
        stream: Literal[False] = False,
        response_model: Optional[Type[T]] = None,
    ) -> CreateChatCompletionResponse: ...

    @overload
    async def generate(
        self,
        messages: List[ChatCompletionRequestMessage],
        temp: float,
        max_tokens: int,
        stream: Literal[True],
        response_model: Optional[Type[T]] = None,
    ) -> Iterator[CreateChatCompletionStreamResponse]: ...

    async def generate(
        self,
        messages: List[ChatCompletionRequestMessage],
        temp: float,
        max_tokens: int,
        stream: bool = False,
        response_model: Optional[Type[T]] = None,
    ) -> CreateChatCompletionResponse | Iterator[CreateChatCompletionStreamResponse]:
        """
        Generates completions with repetition penalty to prevent infinite loops.
        Uses internal streaming to allow safe interruption between tokens.
        If response_model is provided, enforces GBNF grammar for strict JSON output.
        """
        async with self._model_lock:
            model = self.model
            if model is None:
                raise ValueError("Model not loaded")

            self._stop_event.clear()

            # Always use streaming internally to allow for mid-generation halting
            def create_generator():
                if response_model:
                    # Inject JSON schema grammar to force valid JSON output
                    # We cast to Any to bypass strict/outdated type hints in llama-cpp-python
                    return model.create_chat_completion(
                        messages=messages,
                        temperature=temp,
                        repeat_penalty=1.2,
                        stream=True,
                        max_tokens=max_tokens,
                        response_format={
                            "type": "json_object",
                            "schema": response_model.model_json_schema(),
                        },  # type: ignore
                    )

                return model.create_chat_completion(
                    messages=messages,
                    temperature=temp,
                    repeat_penalty=1.2,
                    stream=True,
                    max_tokens=max_tokens,
                )

            iterator = await asyncio.to_thread(create_generator)

            if stream:
                return iterator

            chunks: List[CreateChatCompletionStreamResponse] = []
            try:
                while not self._stop_event.is_set():

                    def get_next():
                        try:
                            return next(iterator)
                        except StopIteration:
                            return None

                    chunk = await asyncio.to_thread(get_next)
                    if chunk is None:
                        break
                    chunks.append(chunk)

                if self._stop_event.is_set():
                    raise asyncio.CancelledError()

            except StopIteration:
                pass

            # Reconstruct full response from chunks
            content = "".join(
                chunk["choices"][0].get("delta", {}).get("content", "")
                for chunk in chunks
            )

            # Build a complete CreateChatCompletionResponse to satisfy type requirements
            return {
                "id": "chatcmpl-internal",
                "object": "chat.completion",
                "created": 0,
                "model": self.current_model_path or "unknown",
                "choices": [
                    {
                        "index": 0,
                        "message": {"role": "assistant", "content": content},
                        "logprobs": None,
                        "finish_reason": "stop",
                    }
                ],
                "usage": {
                    "prompt_tokens": 0,
                    "completion_tokens": len(chunks),
                    "total_tokens": len(chunks),
                },
            }  # type: ignore
