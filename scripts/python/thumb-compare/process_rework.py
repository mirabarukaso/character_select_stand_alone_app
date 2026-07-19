import json
import os

FILE_DIR = os.path.dirname(os.path.abspath(__file__))
OUTPUT_DIR = os.path.join(FILE_DIR, "output")
os.makedirs(OUTPUT_DIR, exist_ok=True)

# Load rework.json output list .xt
REWORK_FILE = os.path.join(OUTPUT_DIR, "rework.json")

with open(REWORK_FILE, "r", encoding="utf-8") as f:
    data = json.load(f)


def filter_and_save(value, filename):
    keys = [k for k, v in data.items() if v == value]
    keys.sort()
    out_path = os.path.join(OUTPUT_DIR, filename)
    if os.path.exists(out_path):
        print(f"Delete exist file: {out_path}")
        os.remove(out_path)
    with open(out_path, 'w', encoding='utf-8') as f:
        for key in keys:
            f.write(key + '\n')
    print(f"Create {out_path} with {len(keys)} items")

OPTIONS = ["Rework", "Remove", "NSFW", "TagChange", "Other"]

# create file
for item in OPTIONS:   
    filter_and_save(item, "{0}.txt".format(item))


