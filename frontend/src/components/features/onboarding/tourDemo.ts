import type { TerminalEntry } from "@/types/session";

export const DEMO_CODE = `public class OrderProcessor {
    private List<Order> orders;

    public void processOrders() {
        for (Order order : orders) {
            if (order != null) {
                if (order.isPending()) {
                    if (order.hasValidAmount()) {
                        if (order.getCustomer().isActive()) {
                            order.process();
                            sendNotification(order);
                        }
                    }
                }
            }
        }
    }

    private void sendNotification(Order order) {
        if (order.getCustomer() != null) {
            if (order.getCustomer().getEmail() != null) {
                if (!order.getCustomer().getEmail().isEmpty()) {
                    emailService.send(order.getCustomer().getEmail(),
                            "Your order is being processed");
                }
            }
        }
    }
}`;

export const DEMO_INSTRUCTION =
  "Extract deeply nested conditionals into well-named methods like isEligibleForProcessing()";

export const DEMO_PHASE_STATES: Record<string, string> = {
  "1": "done_ok",
  "2": "done_ok",
  "3": "done_ok",
  "4": "done_ok",
  "5": "done_ok",
  "6": "done_ok",
};

export const DEMO_TERMINAL_ENTRIES: TerminalEntry[] = [
  {
    id: "demo-1",
    type: "command",
    text: DEMO_INSTRUCTION,
  },
  {
    id: "demo-2",
    type: "log",
    text: "Analyzing control flow structure...",
    icon: "Cpu",
    colorClass: "text-[#5a8cf8]",
  },
  {
    id: "demo-3",
    type: "log",
    text: "Strategy: extract 3 conditional blocks into `isEligibleForProcessing()`, `hasValidPayment()`, `sendCustomerAlert()`",
    icon: "Cpu",
    colorClass: "text-[#5a8cf8]",
  },
  {
    id: "demo-4",
    type: "log",
    text: "Extracting condition to `isEligibleForProcessing()`...",
    icon: "Layers",
    colorClass: "text-[#3dd6c8]",
  },
  {
    id: "demo-5",
    type: "log",
    text: "3 methods extracted, 12 lines simplified",
    icon: "Layers",
    colorClass: "text-[#3dd6c8]",
  },
  {
    id: "demo-6",
    type: "log",
    text: "AST validation passed. Type resolution verified.",
    icon: "FileCode2",
    colorClass: "text-[#e09c3b]",
  },
  {
    id: "demo-7",
    type: "log",
    text: "Complexity reduced from 8→2. All extracted methods resolve correctly. Approved.",
    icon: "CheckCircle2",
    colorClass: "text-[#4ec97e]",
  },
  {
    id: "demo-8",
    type: "system",
    text: "Refactoring cycle complete. Output ready.",
    colorClass: "text-[#a78bfa]",
  },
];
