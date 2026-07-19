import argparse
import csv
import os
import sys

FILE_DIR = os.path.dirname(os.path.abspath(__file__))
OUTPUT_DIR = os.path.join(FILE_DIR, "output")
DATA_DIR = os.path.join(FILE_DIR, "data")

DEFAULT_INPUT_CSV = os.path.join(DATA_DIR, 'waiIllustriousSDXL_v160_characters.csv')
DEFAULT_OUTPUT_CSV = os.path.join(OUTPUT_DIR, 'waiIllustriousSDXL_v160_characters.csv')
DEFAULT_OUTPUT_TXT = os.path.join(OUTPUT_DIR, 'waiIllustriousSDXL_v160_characters.txt')


def parse_args():
    parser = argparse.ArgumentParser(
        description='Read a CSV character file, sort its rows, and write sorted CSV and TXT outputs.'
    )
    parser.add_argument(
        'input_csv',
        nargs='?',
        default=DEFAULT_INPUT_CSV,
        help='Path to the input CSV file. Defaults to scripts/python/thumb-compare/data/waiANIMA_v10Base10_characters.csv.'
    )
    parser.add_argument(
        '--output-csv',
        default=DEFAULT_OUTPUT_CSV,
        help='Path to the output CSV file. Defaults to scripts/python/thumb-compare/output/waiANIMA_v10Base10_characters_sorted.csv.'
    )
    parser.add_argument(
        '--output-txt',
        default=DEFAULT_OUTPUT_TXT,
        help='Path to the output TXT file. Defaults to scripts/python/thumb-compare/output/waiANIMA_v10Base10_characters_sorted.txt.'
    )
    parser.add_argument(
        '--key-index',
        type=int,
        default=1,
        help='Zero-based column index used for sorting and TXT output. Defaults to 1.'
    )
    parser.add_argument(
        '--has-header',
        action='store_true',
        help='Treat the first CSV row as a header and preserve it in the output CSV.'
    )
    return parser.parse_args()


def ensure_output_dir(path):
    os.makedirs(os.path.dirname(path), exist_ok=True)


def load_csv(path):
    rows = []
    with open(path, 'r', encoding='utf-8', newline='') as csvfile:
        reader = csv.reader(csvfile)
        for row in reader:
            if row:
                rows.append([cell.strip() for cell in row])
    return rows


def write_csv(path, rows):
    with open(path, 'w', encoding='utf-8', newline='') as csvfile:
        writer = csv.writer(csvfile)
        writer.writerows(rows)


def write_txt(path, values):
    with open(path, 'w', encoding='utf-8') as f:
        for value in values:
            f.write(value + '\n')


def main():
    args = parse_args()

    if not os.path.exists(args.input_csv):
        print(f"Error: input CSV file not found: {args.input_csv}")
        sys.exit(1)

    ensure_output_dir(args.output_csv)
    ensure_output_dir(args.output_txt)

    rows = load_csv(args.input_csv)
    if not rows:
        print(f"Error: no rows found in input CSV: {args.input_csv}")
        sys.exit(1)

    header = None
    data_rows = rows
    if args.has_header:
        header = rows[0]
        data_rows = rows[1:]

    if not data_rows:
        print(f"Error: no data rows found in input CSV after header removal: {args.input_csv}")
        sys.exit(1)

    key_index = args.key_index
    def sort_key(row):
        if key_index < len(row):
            return row[key_index].strip()
        return ''

    data_rows.sort(key=sort_key)

    output_rows = [header] + data_rows if header is not None else data_rows
    write_csv(args.output_csv, output_rows)

    txt_values = [sort_key(row) for row in data_rows if sort_key(row)]
    write_txt(args.output_txt, txt_values)

    print(f"Loaded {len(rows)} rows from {args.input_csv}.")
    if header is not None:
        print(f"Preserved header: {header}")
    print(f"Wrote sorted CSV to {args.output_csv}.")
    print(f"Wrote TXT list to {args.output_txt}.")
    print("Done.")


if __name__ == '__main__':
    main()
