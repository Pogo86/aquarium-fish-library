"""Config flow for Aquarium Manager."""

from __future__ import annotations

from typing import Any

import voluptuous as vol

from homeassistant import config_entries
from homeassistant.data_entry_flow import FlowResult
from homeassistant.helpers.selector import (
    EntitySelector,
    NumberSelector,
    NumberSelectorConfig,
    NumberSelectorMode,
    TextSelector,
)
from homeassistant.util import slugify

from .const import (
    CONF_LENGTH_CM,
    CONF_SPECIES_LIBRARY_URL,
    CONF_TANK_NAME,
    CONF_TEMPERATURE_ENTITY,
    CONF_WATER_DEPTH_CM,
    CONF_WATER_TYPE,
    CONF_WIDTH_CM,
    DOMAIN,
    WATER_TYPE_FRESHWATER,
    WATER_TYPE_MARINE,
)
from .species import is_http_url


class AquariumManagerConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    """Handle Aquarium Manager config flow."""

    VERSION = 1

    @staticmethod
    def async_get_options_flow(
        config_entry: config_entries.ConfigEntry,
    ) -> config_entries.OptionsFlow:
        """Create the options flow."""
        return AquariumManagerOptionsFlow()

    async def async_step_user(
        self, user_input: dict[str, Any] | None = None
    ) -> FlowResult:
        """Create an aquarium."""
        if user_input is not None:
            tank_name = user_input[CONF_TANK_NAME].strip()

            await self.async_set_unique_id(slugify(tank_name))
            self._abort_if_unique_id_configured()

            user_input[CONF_TANK_NAME] = tank_name

            return self.async_create_entry(
                title=tank_name,
                data=user_input,
            )

        dimension_selector = NumberSelector(
            NumberSelectorConfig(
                min=1,
                max=500,
                step=0.1,
                unit_of_measurement="cm",
                mode=NumberSelectorMode.BOX,
            )
        )

        schema = vol.Schema(
            {
                vol.Required(
                    CONF_TANK_NAME,
                    default="Main Aquarium",
                ): TextSelector(),
                vol.Required(
                    CONF_LENGTH_CM,
                    default=80,
                ): dimension_selector,
                vol.Required(
                    CONF_WIDTH_CM,
                    default=35,
                ): dimension_selector,
                vol.Required(
                    CONF_WATER_DEPTH_CM,
                    default=42,
                ): dimension_selector,
                vol.Required(
                    CONF_WATER_TYPE,
                    default=WATER_TYPE_FRESHWATER,
                ): vol.In(
                    {
                        WATER_TYPE_FRESHWATER: "Freshwater",
                        WATER_TYPE_MARINE: "Marine",
                    }
                ),
                vol.Optional(CONF_TEMPERATURE_ENTITY): EntitySelector(),
            }
        )

        return self.async_show_form(
            step_id="user",
            data_schema=schema,
        )


class AquariumManagerOptionsFlow(config_entries.OptionsFlowWithReload):
    """Configure optional Aquarium Manager behavior."""

    async def async_step_init(
        self, user_input: dict[str, Any] | None = None
    ) -> FlowResult:
        """Manage Aquarium Manager options."""
        errors: dict[str, str] = {}

        if user_input is not None:
            library_url = str(user_input.get(CONF_SPECIES_LIBRARY_URL, "") or "").strip()
            if library_url and not is_http_url(library_url):
                errors[CONF_SPECIES_LIBRARY_URL] = "invalid_url"
            else:
                return self.async_create_entry(
                    data={CONF_SPECIES_LIBRARY_URL: library_url}
                )

        current_url = str(
            self.config_entry.options.get(CONF_SPECIES_LIBRARY_URL, "") or ""
        )
        schema = vol.Schema(
            {
                vol.Optional(
                    CONF_SPECIES_LIBRARY_URL,
                    default=current_url,
                ): TextSelector(),
            }
        )

        return self.async_show_form(
            step_id="init",
            data_schema=schema,
            errors=errors,
        )
