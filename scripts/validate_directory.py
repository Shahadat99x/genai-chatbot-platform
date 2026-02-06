import json
import re
import sys
from pathlib import Path

# Config
INPUT_FILE = Path("data/raw/facilities.sample.jsonl")
OUTPUT_FILE = Path("data/processed/facilities.cleaned.jsonl")
REQUIRED_FIELDS = ["facility_id", "name", "type", "city", "address"]

def clean_phone(phone: str) -> str:
    if not phone:
        return ""
    # Remove non-digits/plus
    return re.sub(r"[^0-9+]", "", phone)

def clean_hours(hours: str) -> str:
    if not hours:
        return "Unknown"
    return hours.strip()

def validate_and_clean():
    if not INPUT_FILE.exists():
        print(f"Error: Input file {INPUT_FILE} not found.")
        sys.exit(1)

    print(f"Validating {INPUT_FILE}...")
    
    valid_count = 0
    invalid_count = 0
    cleaned_data = []

    with open(INPUT_FILE, "r", encoding="utf-8") as f:
        for line_num, line in enumerate(f, 1):
            line = line.strip()
            if not line:
                continue
            
            try:
                record = json.loads(line)
            except json.JSONDecodeError:
                print(f"Line {line_num}: Invalid JSON")
                invalid_count += 1
                continue

            # Check required fields
            missing = [k for k in REQUIRED_FIELDS if k not in record or not record[k]]
            if missing:
                print(f"Line {line_num}: Missing required fields {missing}")
                invalid_count += 1
                continue

            # Normalize
            record["phone"] = clean_phone(record.get("phone", ""))
            record["hours"] = clean_hours(record.get("hours", ""))
            
            # Add to cleaned list
            cleaned_data.append(record)
            valid_count += 1

    # Write output
    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        for record in cleaned_data:
            f.write(json.dumps(record) + "\n")

    print(f"\nSummary:")
    print(f"Total processed: {line_num}")
    print(f"Valid: {valid_count}")
    print(f"Invalid: {invalid_count}")
    print(f"Output written to {OUTPUT_FILE}")

if __name__ == "__main__":
    validate_and_clean()
