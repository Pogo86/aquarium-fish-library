"""Constants for Aquarium Manager."""

DOMAIN = "aquarium_manager"

PLATFORMS = ["number", "sensor"]

CONF_TANK_NAME = "tank_name"
CONF_LENGTH_CM = "length_cm"
CONF_WIDTH_CM = "width_cm"
CONF_WATER_DEPTH_CM = "water_depth_cm"
CONF_WATER_TYPE = "water_type"
CONF_TEMPERATURE_ENTITY = "temperature_entity"
CONF_SPECIES_LIBRARY_URL = "species_library_url"

WATER_TYPE_FRESHWATER = "freshwater"
WATER_TYPE_MARINE = "marine"

MANUFACTURER = "Aquarium Manager"
MODEL = "Virtual Aquarium"

SERVICE_ADD_STOCK = "add_stock"
SERVICE_UPDATE_STOCK = "update_stock"
SERVICE_REMOVE_STOCK = "remove_stock"
SERVICE_REFRESH_LIBRARY = "refresh_species_library"

ATTR_ENTRY_ID = "entry_id"
ATTR_STOCK_ID = "stock_id"
ATTR_NAME = "name"
ATTR_QUANTITY = "quantity"
ATTR_SCIENTIFIC_NAME = "scientific_name"
ATTR_NOTES = "notes"

# Fields that can be populated from the species library and then overridden by
# the user on an individual stocking record.
PROFILE_FIELDS = (
    "scientific_name",
    "adult_size_cm",
    "temperature_min",
    "temperature_max",
    "ph_min",
    "ph_max",
    "gh_min",
    "gh_max",
    "kh_min",
    "kh_max",
    "min_group_size",
    "min_tank_length_cm",
    "min_tank_width_cm",
    "min_tank_height_cm",
    "min_tank_volume_l",
    "social_type",
    "temperament",
    "swimming_zone",
    "compatibility",
    "difficulty",
    "diet_type",
    "environment_type",
    "ecology",
    "climate",
    "distribution",
)

STOCK_STORAGE_VERSION = 1
STOCK_STORAGE_KEY_PREFIX = "aquarium_manager.stocking"
LIBRARY_STORAGE_VERSION = 1
LIBRARY_STORAGE_KEY_PREFIX = "aquarium_manager.species_library"

LIBRARY_REFRESH_HOURS = 24
LIBRARY_SCHEMA_VERSION = 1
LIBRARY_MAX_BYTES = 5 * 1024 * 1024
LIBRARY_MAX_SPECIES = 5000

SIGNAL_STOCKING_UPDATED = f"{DOMAIN}_stocking_updated"
SIGNAL_LIBRARY_UPDATED = f"{DOMAIN}_library_updated"
