# Aquarium Manager fish library

This folder is ready to become a small GitHub repository.

## Files

- `fish_library.json` — the file Home Assistant downloads.
- `schema.json` — JSON Schema for editors/validation.

## GitHub setup

1. Create a GitHub repository, for example `aquarium-fish-library`.
2. Upload `fish_library.json` and `schema.json`.
3. Open `fish_library.json` on GitHub and choose **Raw**.
4. Copy the raw URL. It will look like:

   `https://raw.githubusercontent.com/YOUR-NAME/aquarium-fish-library/main/fish_library.json`

5. In Home Assistant open **Settings → Devices & services → Aquarium Manager → Configure**.
6. Paste that URL into **Fish library JSON URL**.

Aquarium Manager checks the URL on setup and every 24 hours. You can also use the **Refresh species library** action immediately after editing GitHub.

## Adding a fish

Copy an existing object in the `species` array, give it a unique `id`, and change the fields. Unknown or unavailable values can be `null`.

Keep `schema_version` at `1` unless Aquarium Manager explicitly introduces a new schema.
