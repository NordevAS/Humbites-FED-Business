// menuStorage.ts - localStorage management for menu items

interface StoredMenuItem {
  id: string;
  businessId: number;
  categoryId: number;
  name: string;
  description: string;
  imageUrl: string;
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

// Initialize storage if empty
const initializeStorage = (): MenuStorage => ({
  items: [],
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
