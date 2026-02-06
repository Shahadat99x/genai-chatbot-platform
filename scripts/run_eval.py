import argparse
import json
import time
import requests
import os
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor

MODES = ["baseline", "rag", "rag_safety"]

def run_prompt(prompt, api_base, mode, out_dir):
    url = f"{api_base.rstrip('/')}/chat"
    
    # Unique session ID per prompt+mode to avoid state leakage (unless testing state)
    # For this eval, we want independent checks usually.
    # However, for lock testing, we might need state. 
    # But this script treats each line as atomic for now.
    session_id = f"eval-{mode}-{prompt['id']}"
    
    payload = {
        "message": prompt["message"],
        "mode": mode,
        "session_id": session_id
    }
    
    start_time = time.time()
    try:
        response = requests.post(url, json=payload, timeout=60)
        latency_ms = (time.time() - start_time) * 1000
        
        if response.status_code == 200:
            data = response.json()
            error = None
        else:
            data = None
            error = f"HTTP {response.status_code}: {response.text}"
            
    except Exception as e:
        latency_ms = (time.time() - start_time) * 1000
        data = None
        error = str(e)

    result = {
        "timestamp": datetime.now().isoformat(),
        "prompt_id": prompt["id"],
        "category": prompt["category"],
        "message": prompt["message"],
        "expected": prompt.get("expected", {}),
        "mode": mode,
        "latency_ms": latency_ms,
        "response": data,
        "error": error
    }
    
    # Write immediately to file (thread-safe enough for append if careful, 
    # but here we'll just return and write in main loop or use separate files per mode)
    return result

def main():
    parser = argparse.ArgumentParser(description="Run Evaluation")
    parser.add_argument("--api-base", default="http://127.0.0.1:8000")
    parser.add_argument("--prompts", default="eval/prompts.jsonl")
    parser.add_argument("--out", default="eval/results")
    parser.add_argument("--models", default="baseline_raw,rag_raw,rag_safety", help="Comma-separated list of modes/models to run")
    parser.add_argument("--modes", help="Alias for --models", dest="models_alias")
    parser.add_argument("--limit", type=int, default=None)
    
    args = parser.parse_args()

    # Handle alias
    if args.models_alias:
        args.models = args.models_alias

    
    # Setup output dir
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    run_dir = os.path.join(args.out, timestamp)
    os.makedirs(run_dir, exist_ok=True)
    print(f"Starting Run: {timestamp}")
    print(f"Output Directory: {run_dir}")
    
    # Read prompts
    prompts = []
    with open(args.prompts, "r", encoding="utf-8") as f:
        for line in f:
            if line.strip():
                prompts.append(json.loads(line))
    
    if args.limit:
        prompts = prompts[:args.limit]
        
    modes = args.models.split(",")
    
    # Run
    for mode in modes:
        print(f"Running mode: {mode}...")
        results_file = os.path.join(run_dir, f"{mode}.jsonl")
        
        with open(results_file, "w", encoding="utf-8") as f_out:
            for i, prompt in enumerate(prompts):
                print(f"  [{i+1}/{len(prompts)}] {prompt['id']}...", end="\r")
                res = run_prompt(prompt, args.api_base, mode, run_dir)
                f_out.write(json.dumps(res) + "\n")
                f_out.flush() # Ensure written
        print(f"\n  Completed {mode}.")

    print("Evaluation Complete.")

if __name__ == "__main__":
    main()
