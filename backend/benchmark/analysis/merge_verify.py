import os
import json
import glob

def main():
    v2_dir = "backend/benchmark/results/v2/multi"
    verify_file = "backend/benchmark/results/v2_patch_verify/multi/benchmark_279_aborts_77_verify.json"
    out_dir = "backend/benchmark/results/v2_final/multi"
    
    os.makedirs(out_dir, exist_ok=True)
    
    print("Loading verified entries...")
    with open(verify_file) as f:
        verify_data = json.load(f)
    
    verified_entries = {entry["num"]: entry for entry in verify_data["entries"]}
    print(f"Loaded {len(verified_entries)} verified entries.")
    
    batch_files = glob.glob(os.path.join(v2_dir, "benchmark_279_batch_*.json"))
    
    replaced_count = 0
    total_count = 0
    
    for bf in batch_files:
        with open(bf) as f:
            batch_data = json.load(f)
        
        for i, entry in enumerate(batch_data["entries"]):
            num = entry["num"]
            if num in verified_entries:
                batch_data["entries"][i] = verified_entries[num]
                replaced_count += 1
            total_count += 1
            
        out_name = os.path.basename(bf)
        out_path = os.path.join(out_dir, out_name)
        with open(out_path, "w") as f:
            json.dump(batch_data, f, indent=2)
            
    print(f"Merge complete. Processed {total_count} total entries across {len(batch_files)} batch files.")
    print(f"Replaced {replaced_count} entries with verified data.")

if __name__ == "__main__":
    main()
