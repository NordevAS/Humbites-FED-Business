// menuStorage.ts - localStorage management for menu items

interface StoredMenuItem {
  id: string;
  businessId: number;
  categoryId: number;
  name: string;
  description: string;
  imageUrl: string;
  images?: string[];
  basePrice: number;
  totalPrice: number;
  enabled: boolean;
  sizes: {
    id: string;
    name: string;
    additionalPrice: number;
    isDefault: boolean;
  }[];
  ingredients: {
    id: string;
    name: string;
    minAmount: number;
    maxAmount: number;
    pricePerUnit: number;
    currentAmount: number;
  }[];
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

interface MenuStorage {
  items: StoredMenuItem[];
  version: string;
  lastModified: string;
}

const STORAGE_KEY = "humbites_menu_items";
const STORAGE_VERSION = "1.0.0";

// 16 Default demo items - one for each category
const DEFAULT_DEMO_ITEMS: StoredMenuItem[] = [
  {
    id: "demo_1",
    businessId: 1,
    categoryId: 1,
    name: "Garlic Bread Sticks",
    description: "Warm bread sticks with garlic butter and parmesan cheese",
    imageUrl:
      "https://images.unsplash.com/photo-1619367868495-a3eb0b53f557?w=500",
    images: [
      "https://images.unsplash.com/photo-1619367868495-a3eb0b53f557?w=500",
    ],
    basePrice: 6.99,
    totalPrice: 6.99,
    enabled: true,
    sizes: [
      { id: "size_1", name: "Regular", additionalPrice: 0, isDefault: true },
    ],
    ingredients: [],
    tags: ["Vegetarian", "Bestseller"],
    createdAt: "2025-01-01T00:00:00.000Z",
    updatedAt: "2025-01-01T00:00:00.000Z",
  },
  {
    id: "demo_2",
    businessId: 1,
    categoryId: 2,
    name: "Grilled Salmon",
    description:
      "Fresh Atlantic salmon grilled to perfection with lemon butter sauce",
    imageUrl:
      "https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=500",
    images: [
      "https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=500",
    ],
    basePrice: 24.99,
    totalPrice: 24.99,
    enabled: true,
    sizes: [
      { id: "size_2", name: "Regular", additionalPrice: 0, isDefault: true },
      { id: "size_3", name: "Large", additionalPrice: 6.0, isDefault: false },
    ],
    ingredients: [],
    tags: ["Gluten-Free", "Chef's Special"],
    createdAt: "2025-01-01T00:00:00.000Z",
    updatedAt: "2025-01-01T00:00:00.000Z",
  },
  {
    id: "demo_3",
    businessId: 1,
    categoryId: 3,
    name: "French Fries",
    description: "Crispy golden fries with a side of ketchup",
    imageUrl:
      "https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=500",
    images: [
      "https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=500",
    ],
    basePrice: 4.99,
    totalPrice: 4.99,
    enabled: true,
    sizes: [
      { id: "size_4", name: "Small", additionalPrice: 0, isDefault: true },
      { id: "size_5", name: "Large", additionalPrice: 2.0, isDefault: false },
    ],
    ingredients: [],
    tags: ["Vegan"],
    createdAt: "2025-01-01T00:00:00.000Z",
    updatedAt: "2025-01-01T00:00:00.000Z",
  },
  {
    id: "demo_4",
    businessId: 1,
    categoryId: 4,
    name: "Tiramisu",
    description:
      "Classic Italian dessert with coffee-soaked ladyfingers and mascarpone",
    imageUrl:
      "https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?w=500",
    images: [
      "https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?w=500",
    ],
    basePrice: 8.99,
    totalPrice: 8.99,
    enabled: true,
    sizes: [
      { id: "size_6", name: "Regular", additionalPrice: 0, isDefault: true },
    ],
    ingredients: [],
    tags: ["Bestseller"],
    createdAt: "2025-01-01T00:00:00.000Z",
    updatedAt: "2025-01-01T00:00:00.000Z",
  },
  {
    id: "demo_5",
    businessId: 1,
    categoryId: 5,
    name: "Fresh Lemonade",
    description: "Freshly squeezed lemonade with mint",
    imageUrl:
      "https://images.unsplash.com/photo-1523677011781-c91d1bbe2f9d?w=500",
    images: [
      "https://images.unsplash.com/photo-1523677011781-c91d1bbe2f9d?w=500",
    ],
    basePrice: 3.99,
    totalPrice: 3.99,
    enabled: true,
    sizes: [
      { id: "b1", name: "Small", additionalPrice: 0, isDefault: true },
      { id: "b2", name: "Medium", additionalPrice: 1.5, isDefault: false },
      { id: "b3", name: "Large", additionalPrice: 3.0, isDefault: false },
    ],
    ingredients: [],
    tags: ["Vegan"],
    createdAt: "2025-01-01T00:00:00.000Z",
    updatedAt: "2025-01-01T00:00:00.000Z",
  },
  {
    id: "demo_6",
    businessId: 1,
    categoryId: 6,
    name: "Vegan Buddha Bowl",
    description: "Quinoa, roasted vegetables, chickpeas, and tahini dressing",
    imageUrl: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500",
    images: ["https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500"],
    basePrice: 13.99,
    totalPrice: 13.99,
    enabled: true,
    sizes: [
      { id: "size_7", name: "Regular", additionalPrice: 0, isDefault: true },
    ],
    ingredients: [],
    tags: ["Vegan", "Gluten-Free"],
    createdAt: "2025-01-01T00:00:00.000Z",
    updatedAt: "2025-01-01T00:00:00.000Z",
  },
  {
    id: "demo_7",
    businessId: 1,
    categoryId: 7,
    name: "Veggie Wrap",
    description:
      "Fresh vegetables wrapped in a whole wheat tortilla with hummus",
    imageUrl:
      "https://images.unsplash.com/photo-1626700051175-6818013e1d4f?w=500",
    images: [
      "https://images.unsplash.com/photo-1626700051175-6818013e1d4f?w=500",
    ],
    basePrice: 10.99,
    totalPrice: 10.99,
    enabled: true,
    sizes: [
      { id: "size_8", name: "Regular", additionalPrice: 0, isDefault: true },
    ],
    ingredients: [],
    tags: ["Vegetarian"],
    createdAt: "2025-01-01T00:00:00.000Z",
    updatedAt: "2025-01-01T00:00:00.000Z",
  },
  {
    id: "demo_8",
    businessId: 1,
    categoryId: 8,
    name: "Spicy Chicken Wings",
    description: "Crispy wings tossed in our signature hot sauce",
    imageUrl:
      "https://images.unsplash.com/photo-1527477396000-e27163b481c2?w=500",
    images: [
      "https://images.unsplash.com/photo-1527477396000-e27163b481c2?w=500",
    ],
    basePrice: 11.99,
    totalPrice: 11.99,
    enabled: true,
    sizes: [
      { id: "size_9", name: "6 Pieces", additionalPrice: 0, isDefault: true },
      {
        id: "size_10",
        name: "12 Pieces",
        additionalPrice: 8.0,
        isDefault: false,
      },
    ],
    ingredients: [],
    tags: ["Spicy", "Bestseller"],
    createdAt: "2025-01-01T00:00:00.000Z",
    updatedAt: "2025-01-01T00:00:00.000Z",
  },
  {
    id: "demo_9",
    businessId: 1,
    categoryId: 9,
    name: "Grilled Shrimp Skewers",
    description: "Succulent shrimp marinated and grilled with garlic butter",
    imageUrl:
      "https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=500",
    images: [
      "https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=500",
    ],
    basePrice: 16.99,
    totalPrice: 16.99,
    enabled: true,
    sizes: [
      { id: "size_11", name: "Regular", additionalPrice: 0, isDefault: true },
    ],
    ingredients: [],
    tags: ["Gluten-Free"],
    createdAt: "2025-01-01T00:00:00.000Z",
    updatedAt: "2025-01-01T00:00:00.000Z",
  },
  {
    id: "demo_10",
    businessId: 1,
    categoryId: 10,
    name: "Truffle Mac & Cheese",
    description: "Creamy mac and cheese with black truffle oil",
    imageUrl: "https://images.unsplash.com/photo-1543339494-b4cd4f7ba686?w=500",
    images: ["https://images.unsplash.com/photo-1543339494-b4cd4f7ba686?w=500"],
    basePrice: 14.99,
    totalPrice: 14.99,
    enabled: true,
    sizes: [
      { id: "size_12", name: "Regular", additionalPrice: 0, isDefault: true },
    ],
    ingredients: [],
    tags: ["Chef's Special", "Vegetarian"],
    createdAt: "2025-01-01T00:00:00.000Z",
    updatedAt: "2025-01-01T00:00:00.000Z",
  },
  {
    id: "demo_11",
    businessId: 1,
    categoryId: 11,
    name: "Margherita Pizza",
    description:
      "Fresh mozzarella, tomatoes, basil, and olive oil on hand-tossed dough",
    imageUrl:
      "https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=500",
    images: [
      "https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=500",
    ],
    basePrice: 14.99,
    totalPrice: 14.99,
    enabled: true,
    sizes: [
      { id: "size_13", name: "Small", additionalPrice: 0, isDefault: true },
      { id: "size_14", name: "Medium", additionalPrice: 4.0, isDefault: false },
      { id: "size_15", name: "Large", additionalPrice: 7.0, isDefault: false },
    ],
    ingredients: [],
    tags: ["Vegetarian", "Bestseller"],
    createdAt: "2025-01-01T00:00:00.000Z",
    updatedAt: "2025-01-01T00:00:00.000Z",
  },
  {
    id: "demo_12",
    businessId: 1,
    categoryId: 12,
    name: "Fettuccine Alfredo",
    description: "Classic creamy Alfredo sauce with fettuccine pasta",
    imageUrl:
      "https://images.unsplash.com/photo-1645112411341-6c4fd023714a?w=500",
    images: [
      "https://images.unsplash.com/photo-1645112411341-6c4fd023714a?w=500",
    ],
    basePrice: 15.99,
    totalPrice: 15.99,
    enabled: true,
    sizes: [
      { id: "size_16", name: "Regular", additionalPrice: 0, isDefault: true },
      { id: "size_17", name: "Large", additionalPrice: 4.0, isDefault: false },
    ],
    ingredients: [],
    tags: ["Vegetarian"],
    createdAt: "2025-01-01T00:00:00.000Z",
    updatedAt: "2025-01-01T00:00:00.000Z",
  },
  {
    id: "demo_13",
    businessId: 1,
    categoryId: 13,
    name: "Caesar Salad",
    description:
      "Crisp romaine lettuce, parmesan cheese, croutons, and Caesar dressing",
    imageUrl: "https://images.unsplash.com/photo-1546793665-c74683f339c1?w=500",
    images: ["https://images.unsplash.com/photo-1546793665-c74683f339c1?w=500"],
    basePrice: 9.99,
    totalPrice: 9.99,
    enabled: true,
    sizes: [
      { id: "size_18", name: "Regular", additionalPrice: 0, isDefault: true },
    ],
    ingredients: [],
    tags: ["Vegetarian"],
    createdAt: "2025-01-01T00:00:00.000Z",
    updatedAt: "2025-01-01T00:00:00.000Z",
  },
  {
    id: "demo_14",
    businessId: 1,
    categoryId: 14,
    name: "Tomato Basil Soup",
    description: "Creamy tomato soup with fresh basil",
    imageUrl: "https://images.unsplash.com/photo-1547592166-23ac45744acd?w=500",
    images: ["https://images.unsplash.com/photo-1547592166-23ac45744acd?w=500"],
    basePrice: 7.99,
    totalPrice: 7.99,
    enabled: true,
    sizes: [
      { id: "size_19", name: "Cup", additionalPrice: 0, isDefault: true },
      { id: "size_20", name: "Bowl", additionalPrice: 2.5, isDefault: false },
    ],
    ingredients: [],
    tags: ["Vegetarian", "Vegan"],
    createdAt: "2025-01-01T00:00:00.000Z",
    updatedAt: "2025-01-01T00:00:00.000Z",
  },
  {
    id: "demo_15",
    businessId: 1,
    categoryId: 15,
    name: "Avocado Toast",
    description:
      "Smashed avocado on sourdough with cherry tomatoes and poached egg",
    imageUrl:
      "https://images.unsplash.com/photo-1541519227354-08fa5d50c44d?w=500",
    images: [
      "https://images.unsplash.com/photo-1541519227354-08fa5d50c44d?w=500",
    ],
    basePrice: 11.99,
    totalPrice: 11.99,
    enabled: true,
    sizes: [
      { id: "size_21", name: "Regular", additionalPrice: 0, isDefault: true },
    ],
    ingredients: [],
    tags: ["Vegetarian", "New Item"],
    createdAt: "2025-01-01T00:00:00.000Z",
    updatedAt: "2025-01-01T00:00:00.000Z",
  },
  {
    id: "demo_16",
    businessId: 1,
    categoryId: 16,
    name: "Classic Cheeseburger",
    description:
      "Juicy beef patty with melted cheddar, lettuce, tomato, and our special sauce",
    imageUrl:
      "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=500",
    images: [
      "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=500",
    ],
    basePrice: 12.99,
    totalPrice: 12.99,
    enabled: true,
    sizes: [
      { id: "size_22", name: "Regular", additionalPrice: 0, isDefault: true },
      { id: "size_23", name: "Large", additionalPrice: 3.0, isDefault: false },
    ],
    ingredients: [],
    tags: ["Bestseller"],
    createdAt: "2025-01-01T00:00:00.000Z",
    updatedAt: "2025-01-01T00:00:00.000Z",
  },
];

// Initialize storage with all 16 demo items
const initializeStorage = (): MenuStorage => ({
  items: [...DEFAULT_DEMO_ITEMS],
  version: STORAGE_VERSION,
  lastModified: new Date().toISOString(),
});

// Get all menu items
export const getMenuItems = (): StoredMenuItem[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      const initial = initializeStorage();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
      return initial.items;
    }

    const parsed: MenuStorage = JSON.parse(stored);

    if (parsed.version !== STORAGE_VERSION) {
      console.warn("Storage version mismatch, migrating data...");
    }

    return parsed.items || [];
  } catch (error) {
    console.error("Failed to get menu items:", error);
    return [];
  }
};

// Save a new menu item
export const saveMenuItem = (
  item: Omit<StoredMenuItem, "id" | "createdAt" | "updatedAt">
): StoredMenuItem => {
  try {
    const items = getMenuItems();

    const newItem: StoredMenuItem = {
      ...item,
      id: `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const storage: MenuStorage = {
      items: [...items, newItem],
      version: STORAGE_VERSION,
      lastModified: new Date().toISOString(),
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(storage));
    return newItem;
  } catch (error) {
    console.error("Failed to save menu item:", error);
    throw error;
  }
};

// Update an existing menu item
export const updateMenuItem = (
  id: string,
  updates: Partial<StoredMenuItem>
): StoredMenuItem | null => {
  try {
    const items = getMenuItems();
    const index = items.findIndex((item) => item.id === id);

    if (index === -1) {
      console.error("Item not found:", id);
      return null;
    }

    const updatedItem: StoredMenuItem = {
      ...items[index],
      ...updates,
      id: items[index].id,
      createdAt: items[index].createdAt,
      updatedAt: new Date().toISOString(),
    };

    items[index] = updatedItem;

    const storage: MenuStorage = {
      items,
      version: STORAGE_VERSION,
      lastModified: new Date().toISOString(),
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(storage));
    return updatedItem;
  } catch (error) {
    console.error("Failed to update menu item:", error);
    return null;
  }
};

// Delete a menu item
export const deleteMenuItem = (id: string): boolean => {
  try {
    const items = getMenuItems();
    const filtered = items.filter((item) => item.id !== id);

    if (filtered.length === items.length) {
      console.warn("Item not found for deletion:", id);
      return false;
    }

    const storage: MenuStorage = {
      items: filtered,
      version: STORAGE_VERSION,
      lastModified: new Date().toISOString(),
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(storage));
    return true;
  } catch (error) {
    console.error("Failed to delete menu item:", error);
    return false;
  }
};

// Toggle item enabled status
export const toggleItemEnabled = (id: string): boolean | null => {
  try {
    const items = getMenuItems();
    const item = items.find((i) => i.id === id);

    if (!item) {
      console.error("Item not found:", id);
      return null;
    }

    const newStatus = !item.enabled;
    updateMenuItem(id, { enabled: newStatus });
    return newStatus;
  } catch (error) {
    console.error("Failed to toggle item status:", error);
    return null;
  }
};

// Search items
export const searchMenuItems = (query: string): StoredMenuItem[] => {
  const items = getMenuItems();
  const lowerQuery = query.toLowerCase();

  return items.filter(
    (item) =>
      item.name.toLowerCase().includes(lowerQuery) ||
      item.description.toLowerCase().includes(lowerQuery) ||
      item.tags?.some((tag) => tag.toLowerCase().includes(lowerQuery))
  );
};

// Get items by category
export const getItemsByCategory = (categoryId: number): StoredMenuItem[] => {
  const items = getMenuItems();
  return items.filter((item) => item.categoryId === categoryId);
};

// Get stats
export const getMenuStats = () => {
  const items = getMenuItems();

  return {
    totalItems: items.length,
    enabledItems: items.filter((i) => i.enabled).length,
    disabledItems: items.filter((i) => !i.enabled).length,
    averagePrice:
      items.reduce((sum, i) => sum + i.basePrice, 0) / (items.length || 1),
    priceRange: {
      min: Math.min(...items.map((i) => i.basePrice), 0),
      max: Math.max(...items.map((i) => i.basePrice), 0),
    },
    itemsByCategory: items.reduce((acc, item) => {
      acc[item.categoryId] = (acc[item.categoryId] || 0) + 1;
      return acc;
    }, {} as Record<number, number>),
  };
};

// Export/Import functions
export const exportMenuData = (): string => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored || JSON.stringify(initializeStorage());
  } catch (error) {
    console.error("Failed to export menu data:", error);
    return JSON.stringify(initializeStorage());
  }
};

export const importMenuData = (jsonData: string): boolean => {
  try {
    const parsed = JSON.parse(jsonData);

    if (!parsed.items || !Array.isArray(parsed.items)) {
      throw new Error("Invalid data structure");
    }

    const storage: MenuStorage = {
      items: parsed.items,
      version: STORAGE_VERSION,
      lastModified: new Date().toISOString(),
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(storage));
    return true;
  } catch (error) {
    console.error("Failed to import menu data:", error);
    return false;
  }
};

// Duplicate an item
export const duplicateMenuItem = (id: string): StoredMenuItem | null => {
  try {
    const items = getMenuItems();
    const item = items.find((i) => i.id === id);

    if (!item) {
      console.error("Item not found for duplication:", id);
      return null;
    }

    const { id: _, createdAt, updatedAt, ...itemData } = item;
    const duplicated = saveMenuItem({
      ...itemData,
      name: `${item.name} (Copy)`,
    });

    return duplicated;
  } catch (error) {
    console.error("Failed to duplicate menu item:", error);
    return null;
  }
};

// Bulk delete
export const bulkDeleteMenuItems = (ids: string[]): number => {
  try {
    const items = getMenuItems();
    const filtered = items.filter((item) => !ids.includes(item.id));
    const deletedCount = items.length - filtered.length;

    const storage: MenuStorage = {
      items: filtered,
      version: STORAGE_VERSION,
      lastModified: new Date().toISOString(),
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(storage));
    return deletedCount;
  } catch (error) {
    console.error("Failed to bulk delete menu items:", error);
    return 0;
  }
};

// Reset to demo items (removes all custom items)
export const resetToDefaults = (): boolean => {
  try {
    const storage: MenuStorage = {
      items: [...DEFAULT_DEMO_ITEMS],
      version: STORAGE_VERSION,
      lastModified: new Date().toISOString(),
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(storage));
    return true;
  } catch (error) {
    console.error("Failed to reset to defaults:", error);
    return false;
  }
};
