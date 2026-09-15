# Round 1 image bank

Drop images here, then run:

```
npm run load:images:dry     # check without uploading
npm run load:images         # upload
```

## Layout

```
images/
  real/          human-taken photographs
  ai/            AI-generated images
  manifest.csv   optional explanations
```

**The folder decides the answer.** A photo in `ai/` is marked as AI for every
student who sees it. Double-check placement before loading — a misfiled image
is a wrong answer nobody can win.

## manifest.csv

```
filename,explanation
portrait-01.webp,Look at the left hand — six fingers.
street-02.webp,The reflection in the window doesn't match the street.
cafe-03.webp,Real photo. The lighting is uneven in a way AI rarely reproduces.
```

Explanations are shown after the competition closes and are the main
educational payoff. Write them as the giveaway detail, not a verdict.

## Rules that matter

- **Under 250KB each.** WebP at ~1200px wide. A game loads 8 or 10 (the Round 1
  format chosen in /admin), often on weak wifi.
- **Keep the pair types comparable.** Two portraits, not one portrait and one
  landscape — otherwise you are testing subject matter, not AI detection.
- **Roughly balanced folders.** If most images are AI, students will notice and
  just guess AI.
- **Aim for 10× the images per game** (80+ for 8 × 5s, 100+ for 10 × 4s), with
  at least a quarter of them in each folder. Below that, neighbours often see
  the same images.
- **Check you can publish them.** Generated images are yours; for real photos
  use openly licensed sources or your own members' pictures.
