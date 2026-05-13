import json
import pandas as pd
import numpy as np
from pathlib import Path

input_dir = Path("pytoh/python/json")
output_dir = Path("pytoh/python/processed")
output_dir.mkdir(parents=True, exist_ok=True)

def is_valid_wordcloud(val):
    if val is None:
        return False
    try:
        return bool(pd.notna(val))
    except (ValueError, TypeError):
        return True  # dict/array values that make notna() ambiguous are real values

for file_path in input_dir.glob("*.json"):
    print(f"Processing {file_path.name}...")

    with open(file_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    df = pd.DataFrame(data)
    details_df = pd.json_normalize(df["pandas"])
    df = pd.concat([df.drop(columns=["pandas"]), details_df], axis=1)

    df["early_access_bool"] = df["early_acces"] == 1
    df.sort_values(by="created")
    df["cusum_positiv"] = df["positiv"].cumsum()
    df["cusum_negativ"] = df["negativ"].cumsum()

    wordclouds = df["wordclouds"].dropna()
    df["wordcloud_key"] = df["wordcloud_key"].astype(str)
    wordclouds.index = wordclouds.index.astype(str)

    df["wordcloud"] = df["wordcloud_key"].map(wordclouds)

    # Clear out the "no relevant reviews" placeholder
    df.loc[df["wordcloud"].apply(
        lambda x: isinstance(x, dict) and x == {"Keine relevanten Reviews": 1}
    ), "wordcloud"] = np.nan

    # reviewBombed is True whenever a real wordcloud exists
    df["review_bomb"] = df["wordcloud"].apply(is_valid_wordcloud)

    result = {
        "id": df["id"].iloc[0],
        "name": df["name"].iloc[0],
        "startDate": df["startdate"].iloc[0],
        "endDate": df["enddate"].iloc[0],
        "data": []
    }

    for _, row in df.iterrows():
        wordcloud_value = row["wordcloud"] if is_valid_wordcloud(row["wordcloud"]) else {}

        result["data"].append({
            "time": row["created"],
            "earlyAccess": bool(row["early_access_bool"]),
            "reviewBombed": bool(row["review_bomb"]),
            "wordClouds": wordcloud_value,
            "values": {
                "positiv": int(row["positiv"]),
                "cusumPositiv": int(row["cusum_positiv"]),
                "negativ": int(row["negativ"]),
                "cusumNegativ": int(row["cusum_negativ"]),
            }
        })

    output_file = output_dir / file_path.name
    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(result, f, indent=4, ensure_ascii=False)

    print(f"Saved -> {output_file}")