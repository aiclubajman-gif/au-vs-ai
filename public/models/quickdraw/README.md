# Drawing model goes here

Empty until the model is trained. The app detects this and uses the mock
classifier, so the game stays fully playable.

## To install the real model

1. Run `notebooks/train_drawing_model.ipynb` in Google Colab
2. Download `quickdraw-model.zip` from the last cell
3. Unzip its contents into this folder

You should end up with:

```
public/models/quickdraw/
  model.json
  group1-shard1of1.bin   (one or more .bin files)
  labels.json
```

4. Restart the dev server
5. Open /debug/draw and check that predictions look sane

`.bin` files are gitignored by default because they are large. Before deploying
to Vercel, either force-add them (`git add -f public/models/quickdraw/*.bin`)
or remove that line from .gitignore.
