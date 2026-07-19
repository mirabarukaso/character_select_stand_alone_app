import csv
import os
import sys

FILE_DIR = os.path.dirname(os.path.abspath(__file__))
OUTPUT_DIR = os.path.join(FILE_DIR, "output")
DATA_DIR = os.path.join(FILE_DIR, "data")

def main(): # NOSONAR
    # File paths 
    current_file = os.path.join(DATA_DIR, 'waiANIMA_v10Base10_current_characters.txt')
    wai_csv_file = os.path.join(DATA_DIR,'waiANIMA_v10Base10_characters.csv')
    remove_file = os.path.join(OUTPUT_DIR,'Remove.txt')
    
    new_list_file = os.path.join(OUTPUT_DIR,'waiANIMA_v10Base10_current_characters.txt')        
    new_wai_csv_file = os.path.join(OUTPUT_DIR,'waiANIMA_v10Base10_characters.csv')

    # Check that required input files exist
    for f in [current_file, remove_file, wai_csv_file]:
        if not os.path.exists(f):
            print(f"Error: file {f} does not exist. Please check the path.")
            sys.exit(1)

    try:
        # Step 1: read current_character_list.txt
        with open(current_file, 'r', encoding='utf-8') as f:
            current_list = [line.strip() for line in f if line.strip()]

        print(f"Loaded {current_file}: {len(current_list)} records")

        # Step 2: read remove.txt and wrong.txt
        with open(remove_file, 'r', encoding='utf-8') as f:
            remove_set = {line.strip() for line in f if line.strip()}

        print(f"Loaded remove.txt total to remove: {len(remove_set)}")

        # Step 3: filter out items to remove
        new_character_list = [item for item in current_list if item not in remove_set]

        print(f"Remaining after filtering: {len(new_character_list)} records (original {len(current_list)}, removed {len(current_list) - len(new_character_list)})")

        # Step 4: write the new plain list file
        with open(new_list_file, 'w', encoding='utf-8') as f:
            for item in new_character_list:
                f.write(item + '\n')

        print(f"Saved new list to {new_list_file}")

        # Step 5: read wai_characters.csv without a header row
        wai_dict = {}
        with open(wai_csv_file, 'r', encoding='utf-8', newline='') as csvfile:
            reader = csv.reader(csvfile)
            for row_num, row in enumerate(reader, start=1):
                if len(row) < 2:
                    # print(f"Warning: row {row_num} has too few columns, skipping: {row}")
                    continue
                key = row[1].strip()
                value = row[0].strip()
                if key:  # only record when key is not empty
                    if key in wai_dict:
                        print(f"Warning: duplicate key found on row {row_num}; later value will overwrite earlier: {key}")
                    wai_dict[key] = value

        print(f"Loaded {wai_csv_file}: {len(wai_dict)} valid dictionary entries (duplicate keys may have been overwritten)")

        # Step 6: filter using new_character_list, keeping only records whose key is in the new list
        filtered_items = []
        for key in new_character_list:
            if key in wai_dict:
                filtered_items.append((wai_dict[key], key))

        print(f"Matched {len(filtered_items)} records after filtering by the new list")

        # Sort by the value column (string sort, case-sensitive; use x[1].lower() if case-insensitive sort is desired)
        filtered_items.sort(key=lambda x: x[1])

        # Write the new CSV file (rows only, no explicit header row)
        with open(new_wai_csv_file, 'w', encoding='utf-8', newline='') as csvfile:
            writer = csv.writer(csvfile)
            for key, value in filtered_items:
                writer.writerow([key, value])

        print(f"Saved filtered and sorted results to {new_wai_csv_file}")
        print("All operations completed successfully!")

    except Exception as e:
        print(f"An error occurred during execution: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == '__main__':
    main()