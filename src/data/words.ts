export type Category = "tech" | "nature" | "abstract" | "energy" | "food" | "mythic";

export const CATEGORY_META: Record<Category, { label: string; emoji: string; accent: string }> = {
  tech: { label: "Tech", emoji: "🛰", accent: "from-sky-400 to-indigo-500" },
  nature: { label: "Nature", emoji: "🍃", accent: "from-emerald-400 to-teal-500" },
  abstract: { label: "Abstract", emoji: "◎", accent: "from-fuchsia-400 to-purple-500" },
  energy: { label: "Energy", emoji: "⚡", accent: "from-amber-400 to-orange-500" },
  food: { label: "Food", emoji: "🍯", accent: "from-rose-400 to-pink-500" },
  mythic: { label: "Mythic", emoji: "🜁", accent: "from-violet-400 to-blue-500" },
};

export const WORDS: Record<Category, string[]> = {
  tech: [
    "byte", "pixel", "cloud", "logic", "cipher", "vector", "kernel", "proxy", "cache", "node",
    "stack", "quantum", "circuit", "signal", "data", "robot", "matrix", "laser", "crypt", "bit",
    "chip", "mesh", "orbit", "relay", "sync", "beacon", "digit", "modem", "pulse", "grid",
    "forge", "scale", "shift", "loop", "port", "link", "flux", "core", "deck", "index",
  ],
  nature: [
    "river", "maple", "cedar", "stone", "coral", "meadow", "willow", "canyon", "harbor", "tide",
    "fern", "moss", "amber", "birch", "clover", "dune", "grove", "leaf", "otter", "pine",
    "reef", "sable", "thistle", "vine", "wave", "lark", "heron", "bloom", "petal", "aspen",
    "creek", "frost", "glade", "ridge", "summit", "orchid", "lotus", "cove", "lagoon", "stream",
  ],
  abstract: [
    "echo", "flux", "nova", "zenith", "prism", "axiom", "vertex", "lumen", "arc", "halo",
    "theta", "omega", "sigma", "delta", "aura", "void", "loom", "veil", "myth", "rune",
    "spiral", "orb", "facet", "cipher", "chroma", "nexus", "apex", "helix", "quill", "ether",
    "stellar", "lucid", "vivid", "polar", "cosmic", "infinite", "solstice", "mirage", "atlas", "verge",
  ],
  energy: [
    "bolt", "spark", "surge", "blaze", "flare", "ember", "volt", "ignite", "torch", "kinetic",
    "rush", "boost", "thrust", "dash", "vault", "leap", "drive", "charge", "swift", "turbo",
    "rally", "pace", "sprint", "peak", "momentum", "jolt", "zoom", "hustle", "fuse", "burst",
  ],
  food: [
    "honey", "mango", "cocoa", "pepper", "basil", "olive", "mocha", "citrus", "vanilla", "saffron",
    "maple", "truffle", "gelato", "brew", "crumb", "bean", "berry", "spice", "sugar", "toast",
    "clove", "melon", "plum", "fig", "cider", "nectar", "tonic", "cream", "zest", "sesame",
  ],
  mythic: [
    "odin", "orion", "hydra", "titan", "phoenix", "sphinx", "kraken", "valkyr", "lyra", "atlas",
    "selene", "helios", "aurora", "chimera", "pegasus", "norse", "draco", "vesta", "juno", "eos",
    "zephyr", "gaia", "hermes", "onyx", "obsidian", "rune", "wyvern", "griffin", "seraph", "elysium",
  ],
};

export const SUFFIXES = ["ly", "io", "ify", "able", "ora", "ora", "ix", "um", "ara", "eo", "ora", "ia"];

export const TLDS = [".com", ".io", ".ai", ".co", ".app", ".studio", ".xyz", ".dev"];