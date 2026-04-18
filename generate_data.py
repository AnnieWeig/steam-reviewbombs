import pandas as pd
import numpy as np

# fake dataset (replace with your real data)
df = pd.DataFrame({
    "x": np.random.uniform(-1, 1, 300),
    "y": np.random.uniform(-1, 1, 300),
    "z": np.random.uniform(0, 1, 300),
    "value": np.random.rand(300)
})

# example preprocessing (filter + normalize)
df = df[df["value"] > 0.2]

# export to JSON for AR
df.to_json("data.json", orient="records")
print("data.json created")