# Aquarium Manager v0.4 — GitHub fish library

v0.4 moves species data out of the Python code and into a JSON fish library that can be hosted on GitHub and expanded over time.

## What changed

- Fish profiles are now read from JSON instead of being hard-coded in `species.py`.
- A starter `fish_library.json` is still bundled with the integration, so Aquarium Manager works offline.
- You can configure a Raw GitHub URL from **Settings → Devices & services → Aquarium Manager → Configure**.
- The remote library is refreshed on setup and every 24 hours.
- A **Refresh** button appears in the stocking panel when a remote URL is configured.
- The last valid remote file is cached locally.
- A malformed/unreachable GitHub file does **not** replace the current working library.
- Existing stocking is re-matched when the library changes, so a fish you added before its profile existed can acquire a profile later.
- Individual fish parameters edited in Home Assistant are tracked as local overrides and are not overwritten by later library refreshes.
- New entity: `sensor.<tank>_fish_library`.

## Upgrade from v0.3

Replace:

`/config/custom_components/aquarium_manager`

with the `custom_components/aquarium_manager` folder from this package.

Replace:

`/config/www/aquarium-manager-card.js`

with the new file from `www/aquarium-manager-card.js`.

Change your frontend resource to:

`/local/aquarium-manager-card.js?v=0.4.0`

Restart Home Assistant and refresh the browser/app.

Your existing aquarium config entry, water readings and v0.3 stocking storage remain compatible.

## Create your GitHub fish library

The `github-fish-library` folder in this ZIP is a ready-to-upload starting point:

- `fish_library.json`
- `schema.json`
- `README.md`

Create a GitHub repo, upload those files, open `fish_library.json`, choose **Raw**, and copy the raw URL. Example:

`https://raw.githubusercontent.com/YOUR-NAME/aquarium-fish-library/main/fish_library.json`

Then open Aquarium Manager's **Configure** dialog in Home Assistant and paste that URL.

## Editing the library

Each species uses a record such as:

```json
{
  "id": "cardinal_tetra",
  "common_name": "Cardinal tetra",
  "scientific_name": "Paracheirodon axelrodi",
  "aliases": ["cardinal", "cardinal tetras"],
  "adult_size_cm": 3.5,
  "temperature": {"min": 23, "max": 29},
  "ph": {"min": 3.5, "max": 7.5},
  "gh": {"min": 1, "max": 12},
  "kh": null,
  "minimum_group": 8,
  "minimum_tank": {
    "length_cm": 60,
    "width_cm": 30,
    "height_cm": null
  },
  "social_type": "shoal",
  "temperament": "peaceful",
  "swimming_zone": "middle",
  "cautions": ["Best kept in a shoal of at least 8–10."],
  "source": {
    "label": "Seriously Fish",
    "url": "https://www.seriouslyfish.com/species/paracheirodon-axelrodi"
  }
}
```

Unknown data can normally be `null`. `kh` can therefore remain `null` where you do not have a reliable KH recommendation.

## Library status

`sensor.<tank>_fish_library` has a state equal to the number of species in the active library. Its attributes show:

- active source: bundled, cache, or remote
- library name
- schema version
- library updated date
- configured URL
- last successful refresh
- last refresh error

## Manual refresh action

Aquarium Manager registers:

`aquarium_manager.refresh_species_library`

The custom card's **Refresh** button calls this automatically. You can also call it from Developer Tools using the aquarium config-entry ID exposed by the stocking sensor.

## Safety behavior

Remote JSON is treated as data only. Aquarium Manager validates the full document before activating it. If GitHub is offline, the JSON is malformed, duplicate aliases exist, or validation otherwise fails, the active/cached library remains in use and the error is reported on the Fish library sensor.


## v0.4.1 GitHub refresh fix

This release makes the Fish Library **Refresh** button verifiable.

Changes:

- remote library requests include `Cache-Control: no-cache` and a unique cache-busting query parameter;
- the Fish Library sensor now exposes `last_refresh`, `content_sha256`, `remote_etag`, and `remote_last_modified`;
- the card shows the actual fetch time and the first 8 characters of the downloaded JSON SHA-256;
- the button briefly changes to `Updated ✓` after a successful refresh;
- refresh failures show `Failed` and remain available through the sensor's `last_error`.

### Upgrade

Replace:

- `/config/custom_components/aquarium_manager/`
- `/config/www/aquarium-manager-card.js`

Set the Lovelace resource to:

```text
/local/aquarium-manager-card.js?v=0.4.1
```

Restart Home Assistant, then hard-refresh/reload the dashboard.

### Verify a GitHub update

1. Add or change a fish in GitHub.
2. Confirm the GitHub commit contains the changed `fish_library.json`.
3. In Home Assistant, press **Refresh**.
4. The card should display a new `fetched HH:MM:SS` time.
5. If the remote JSON bytes changed, the short fingerprint shown after the time should also change.
6. Developer Tools → States → `sensor.main_aquarium_fish_library` exposes the full `content_sha256`, URL, ETag, last-modified header and any refresh error.

The configured URL should be the raw JSON URL, for example:

```text
https://raw.githubusercontent.com/OWNER/REPOSITORY/main/fish_library.json
```


## v0.4.2 alias-collision fix

A repeated common name or alias no longer rejects the whole remote fish library.

Examples such as:

```json
{
  "common_name": "Bronze Cory",
  "aliases": ["bronze cory", "Bronze Corydoras"]
}
```

are cleaned automatically while loading.

If the same common name/alias belongs to two different species, the library is
still accepted but that ambiguous term is not used for automatic matching.
Scientific names remain unique and always take precedence.

The Fish Library sensor now exposes:

- `ambiguous_name_count`
- `ambiguous_names`

so collisions can be cleaned up in GitHub later without breaking refresh.

Duplicate species IDs and duplicate scientific names remain validation errors.

# Aquarium Manager v0.5.0 — Bioload & Compatibility

This release adds a second **Compatible fish** tab to the custom card and a
new `sensor.<tank>_compatible_fish` entity.

## New features

### Estimated bioload in fish details

Each stocked group now exposes:

- `bioload_points_each`
- `bioload_points_group`

The card shows both values in the fish-detail popup.

The estimate is intentionally a **relative planning index**, calculated as:

```text
quantity × adult_length_cm³ ÷ 100
```

It is useful for comparing the likely scale of additions, but it is **not** a
stocking percentage or a claim about exact waste output. Body shape, diet,
filtration and maintenance still matter.

### Group-size suggestions

The Compatible fish tab has a **Group size suggestions** section.

For every current stock record with a known minimum group size it checks:

```text
current quantity < recorded minimum
```

and shows exactly how many fish would be needed to reach the recorded minimum.

If the aquarium itself is already smaller than that species' recorded minimum
tank dimensions/volume, the card does **not** simply tell you to add more fish.
It instead shows that the group needs additional fish but the tank-size issue
should be resolved first.

### Compatible fish tab

The second tab lists fish from the active GitHub/bundled database that are **not
already stocked**.

A fish is excluded when known data shows a hard conflict such as:

- minimum tank length/width/height is larger than this aquarium;
- minimum tank volume is above this aquarium's geometric water volume;
- its known temperature/pH/GH/KH range does not overlap the current community;
- a current measured water value is outside its known range;
- it is not listed as freshwater for a freshwater aquarium;
- its compatibility field explicitly says it is not a community fish.

Missing data does not automatically reject a fish. Instead the recommendation
is labelled with lower confidence / limited data.

Temperament wording such as aggressive, territorial, fin-nipping or fights its
own kind is presented as a caution rather than being silently ignored.

Each recommendation shows:

- match confidence;
- suggested starting group from the database;
- estimated added bioload;
- care ranges;
- tank requirement;
- temperament/social data;
- source/care notes where available.

The **Add ×N** button adds the suggested group to Aquarium Manager stocking.

### Newer fish-library fields

v0.5.0 understands additional fields produced by the newer importer, including:

- `minimum_tank_volume_l`
- `compatibility`
- `difficulty`
- `diet_type`
- `environment_type`
- `ecology`
- `climate`
- `distribution`
- the newer `sources` mapping

This keeps source links working for fish imported with the current GitHub
workflow.

## Upgrade

Replace:

```text
/config/custom_components/aquarium_manager/
```

and:

```text
/config/www/aquarium-manager-card.js
```

Update the Lovelace resource to:

```text
/local/aquarium-manager-card.js?v=0.5.0
```

Restart Home Assistant and hard-refresh the dashboard.

A new entity should then appear, normally:

```text
sensor.main_aquarium_compatible_fish
```

The existing GitHub library URL and stocking data are retained.
