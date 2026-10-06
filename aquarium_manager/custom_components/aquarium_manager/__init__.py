"""Aquarium Manager integration."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import timedelta
from typing import Any
from uuid import uuid4

import voluptuous as vol

from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant, ServiceCall
from homeassistant.exceptions import HomeAssistantError
from homeassistant.helpers import config_validation as cv
from homeassistant.helpers.dispatcher import async_dispatcher_send
from homeassistant.helpers.event import async_track_time_interval
from homeassistant.helpers.storage import Store
from homeassistant.helpers.typing import ConfigType

from .const import (
    ATTR_ENTRY_ID,
    ATTR_NAME,
    ATTR_QUANTITY,
    ATTR_STOCK_ID,
    CONF_SPECIES_LIBRARY_URL,
    DOMAIN,
    LIBRARY_REFRESH_HOURS,
    PLATFORMS,
    PROFILE_FIELDS,
    SERVICE_ADD_STOCK,
    SERVICE_REFRESH_LIBRARY,
    SERVICE_REMOVE_STOCK,
    SERVICE_UPDATE_STOCK,
    SIGNAL_LIBRARY_UPDATED,
    SIGNAL_STOCKING_UPDATED,
    STOCK_STORAGE_KEY_PREFIX,
    STOCK_STORAGE_VERSION,
)
from .species import SpeciesLibraryManager


@dataclass
class AquariumRuntimeData:
    """Runtime data for one aquarium."""

    hass: HomeAssistant
    entry_id: str
    library_url: str = ""
    readings: dict[str, float | None] = field(default_factory=dict)
    stocking: list[dict[str, Any]] = field(default_factory=list)
    store: Store[dict[str, Any]] | None = None
    library: SpeciesLibraryManager | None = None

    async def async_load(self) -> None:
        """Load fish library, then persisted aquarium data."""
        self.library = SpeciesLibraryManager(
            self.hass,
            self.entry_id,
            self.library_url,
        )
        await self.library.async_load()

        self.store = Store(
            self.hass,
            STOCK_STORAGE_VERSION,
            f"{STOCK_STORAGE_KEY_PREFIX}.{self.entry_id}",
        )
        saved = await self.store.async_load() or {}
        stocking = saved.get("stocking", [])
        changed = False

        if isinstance(stocking, list):
            migrated: list[dict[str, Any]] = []
            for item in stocking:
                if not isinstance(item, dict):
                    continue
                enriched, item_changed = self.library.enrich_stock_item(item)
                migrated.append(enriched)
                changed = changed or item_changed
            self.stocking = migrated

        if changed:
            await self.async_save_stocking(notify=False)

    async def async_save_stocking(self, *, notify: bool = True) -> None:
        """Persist stocking data."""
        if self.store is None:
            return
        await self.store.async_save({"stocking": self.stocking})
        if notify:
            async_dispatcher_send(
                self.hass,
                f"{SIGNAL_STOCKING_UPDATED}_{self.entry_id}",
            )

    async def async_refresh_library(self, *, raise_on_error: bool = False) -> bool:
        """Refresh the species library and re-apply profiles to stocking."""
        if self.library is None:
            raise HomeAssistantError("Fish library is not loaded")

        try:
            success = await self.library.async_refresh(raise_on_error=raise_on_error)
            changed = False

            if success:
                refreshed: list[dict[str, Any]] = []
                for item in self.stocking:
                    enriched, item_changed = self.library.enrich_stock_item(item)
                    refreshed.append(enriched)
                    changed = changed or item_changed
                self.stocking = refreshed
                if changed:
                    await self.async_save_stocking(notify=False)
            return success
        finally:
            # Update status entities even when a manual refresh raises an error.
            async_dispatcher_send(
                self.hass,
                f"{SIGNAL_LIBRARY_UPDATED}_{self.entry_id}",
            )
            async_dispatcher_send(
                self.hass,
                f"{SIGNAL_STOCKING_UPDATED}_{self.entry_id}",
            )


AquariumManagerConfigEntry = ConfigEntry[AquariumRuntimeData]


def _runtime_or_raise(hass: HomeAssistant, entry_id: str) -> AquariumRuntimeData:
    """Return loaded runtime data for a config entry."""
    runtime = hass.data.get(DOMAIN, {}).get(entry_id)
    if not isinstance(runtime, AquariumRuntimeData):
        raise HomeAssistantError(
            "Aquarium is not loaded. Check the config entry ID and integration state."
        )
    return runtime


def _optional_number_schema() -> vol.Any:
    return vol.Any(None, vol.Coerce(float))


def _optional_int_schema() -> vol.Any:
    return vol.Any(None, vol.All(vol.Coerce(int), vol.Range(min=1, max=999)))


async def async_setup(hass: HomeAssistant, config: ConfigType) -> bool:
    """Set up Aquarium Manager and register actions."""
    hass.data.setdefault(DOMAIN, {})

    add_schema = vol.Schema(
        {
            vol.Required(ATTR_ENTRY_ID): cv.string,
            vol.Required(ATTR_NAME): vol.All(cv.string, vol.Length(min=1, max=100)),
            vol.Required(ATTR_QUANTITY): vol.All(vol.Coerce(int), vol.Range(min=1, max=999)),
            vol.Optional("scientific_name", default=""): vol.All(cv.string, vol.Length(max=120)),
            vol.Optional("notes", default=""): vol.All(cv.string, vol.Length(max=500)),
        }
    )

    update_schema_dict: dict[Any, Any] = {
        vol.Required(ATTR_ENTRY_ID): cv.string,
        vol.Required(ATTR_STOCK_ID): cv.string,
        vol.Optional(ATTR_NAME): vol.All(cv.string, vol.Length(min=1, max=100)),
        vol.Optional(ATTR_QUANTITY): vol.All(vol.Coerce(int), vol.Range(min=1, max=999)),
        vol.Optional("scientific_name"): vol.Any(None, vol.All(cv.string, vol.Length(max=120))),
        vol.Optional("notes"): vol.Any(None, vol.All(cv.string, vol.Length(max=500))),
        vol.Optional("adult_size_cm"): _optional_number_schema(),
        vol.Optional("temperature_min"): _optional_number_schema(),
        vol.Optional("temperature_max"): _optional_number_schema(),
        vol.Optional("ph_min"): _optional_number_schema(),
        vol.Optional("ph_max"): _optional_number_schema(),
        vol.Optional("gh_min"): _optional_number_schema(),
        vol.Optional("gh_max"): _optional_number_schema(),
        vol.Optional("kh_min"): _optional_number_schema(),
        vol.Optional("kh_max"): _optional_number_schema(),
        vol.Optional("min_group_size"): _optional_int_schema(),
        vol.Optional("min_tank_length_cm"): _optional_number_schema(),
        vol.Optional("min_tank_width_cm"): _optional_number_schema(),
        vol.Optional("min_tank_height_cm"): _optional_number_schema(),
        vol.Optional("social_type"): vol.Any(None, vol.All(cv.string, vol.Length(max=80))),
        vol.Optional("temperament"): vol.Any(None, vol.All(cv.string, vol.Length(max=160))),
        vol.Optional("swimming_zone"): vol.Any(None, vol.All(cv.string, vol.Length(max=80))),
    }
    update_schema = vol.Schema(update_schema_dict)

    remove_schema = vol.Schema(
        {
            vol.Required(ATTR_ENTRY_ID): cv.string,
            vol.Required(ATTR_STOCK_ID): cv.string,
        }
    )

    refresh_schema = vol.Schema(
        {
            vol.Required(ATTR_ENTRY_ID): cv.string,
        }
    )

    async def async_add_stock(call: ServiceCall) -> None:
        """Add a livestock record and apply a known library profile."""
        runtime = _runtime_or_raise(hass, call.data[ATTR_ENTRY_ID])
        if runtime.library is None:
            raise HomeAssistantError("Fish library is not loaded")

        name = call.data[ATTR_NAME].strip()
        item: dict[str, Any] = {
            "id": uuid4().hex[:12],
            "name": name,
            "quantity": int(call.data[ATTR_QUANTITY]),
            "scientific_name": call.data.get("scientific_name", "").strip(),
            "notes": call.data.get("notes", "").strip(),
            "profile_overrides": [],
        }
        item, _ = runtime.library.enrich_stock_item(item)
        runtime.stocking.append(item)
        await runtime.async_save_stocking()

    async def async_update_stock(call: ServiceCall) -> None:
        """Update a livestock record and remember fields manually overridden by the user."""
        runtime = _runtime_or_raise(hass, call.data[ATTR_ENTRY_ID])
        if runtime.library is None:
            raise HomeAssistantError("Fish library is not loaded")

        stock_id = call.data[ATTR_STOCK_ID]

        for index, existing in enumerate(runtime.stocking):
            if existing.get("id") != stock_id:
                continue

            updated = dict(existing)
            old_name = str(updated.get("name", ""))
            overrides = {
                str(value)
                for value in updated.get("profile_overrides", [])
                if value in PROFILE_FIELDS
            }

            for key, value in call.data.items():
                if key in {ATTR_ENTRY_ID, ATTR_STOCK_ID}:
                    continue
                if isinstance(value, str):
                    value = value.strip()
                updated[key] = value
                if key in PROFILE_FIELDS:
                    overrides.add(key)

            new_name = str(updated.get("name", ""))
            if new_name and new_name.casefold() != old_name.casefold():
                profile = runtime.library.match(new_name)
                if profile is not None:
                    # Selecting a different known species starts from that library
                    # profile. Quantity and personal notes are retained.
                    updated = {
                        "id": updated.get("id", stock_id),
                        "name": new_name,
                        "quantity": updated.get("quantity", 1),
                        "notes": updated.get("notes", ""),
                        "profile_overrides": [],
                    }
                    updated, _ = runtime.library.enrich_stock_item(updated)
                else:
                    updated["profile_id"] = None
                    updated["profile_overrides"] = sorted(overrides)
                    updated["source_label"] = ""
                    updated["source_url"] = ""
                    updated["cautions"] = []
            else:
                updated["profile_overrides"] = sorted(overrides)

            runtime.stocking[index] = updated
            await runtime.async_save_stocking()
            return

        raise HomeAssistantError(f"Stocking record {stock_id} was not found.")

    async def async_remove_stock(call: ServiceCall) -> None:
        """Remove a livestock record."""
        runtime = _runtime_or_raise(hass, call.data[ATTR_ENTRY_ID])
        stock_id = call.data[ATTR_STOCK_ID]
        new_stocking = [
            item for item in runtime.stocking if item.get("id") != stock_id
        ]

        if len(new_stocking) == len(runtime.stocking):
            raise HomeAssistantError(f"Stocking record {stock_id} was not found.")

        runtime.stocking = new_stocking
        await runtime.async_save_stocking()

    async def async_refresh_library(call: ServiceCall) -> None:
        """Refresh a configured remote species library immediately."""
        runtime = _runtime_or_raise(hass, call.data[ATTR_ENTRY_ID])
        await runtime.async_refresh_library(raise_on_error=True)

    if not hass.services.has_service(DOMAIN, SERVICE_ADD_STOCK):
        hass.services.async_register(
            DOMAIN,
            SERVICE_ADD_STOCK,
            async_add_stock,
            schema=add_schema,
        )

    if not hass.services.has_service(DOMAIN, SERVICE_UPDATE_STOCK):
        hass.services.async_register(
            DOMAIN,
            SERVICE_UPDATE_STOCK,
            async_update_stock,
            schema=update_schema,
        )

    if not hass.services.has_service(DOMAIN, SERVICE_REMOVE_STOCK):
        hass.services.async_register(
            DOMAIN,
            SERVICE_REMOVE_STOCK,
            async_remove_stock,
            schema=remove_schema,
        )

    if not hass.services.has_service(DOMAIN, SERVICE_REFRESH_LIBRARY):
        hass.services.async_register(
            DOMAIN,
            SERVICE_REFRESH_LIBRARY,
            async_refresh_library,
            schema=refresh_schema,
        )

    return True


async def async_setup_entry(
    hass: HomeAssistant, entry: AquariumManagerConfigEntry
) -> bool:
    """Set up Aquarium Manager from a config entry."""
    library_url = str(entry.options.get(CONF_SPECIES_LIBRARY_URL, "") or "").strip()
    runtime = AquariumRuntimeData(
        hass=hass,
        entry_id=entry.entry_id,
        library_url=library_url,
    )
    await runtime.async_load()

    entry.runtime_data = runtime
    hass.data.setdefault(DOMAIN, {})[entry.entry_id] = runtime

    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)

    async def _scheduled_library_refresh(_now: Any) -> None:
        if runtime.library_url:
            await runtime.async_refresh_library(raise_on_error=False)

    entry.async_on_unload(
        async_track_time_interval(
            hass,
            _scheduled_library_refresh,
            timedelta(hours=LIBRARY_REFRESH_HOURS),
        )
    )
    return True


async def async_unload_entry(
    hass: HomeAssistant, entry: AquariumManagerConfigEntry
) -> bool:
    """Unload an Aquarium Manager config entry."""
    unloaded = await hass.config_entries.async_unload_platforms(entry, PLATFORMS)
    if unloaded:
        hass.data.get(DOMAIN, {}).pop(entry.entry_id, None)
    return unloaded
