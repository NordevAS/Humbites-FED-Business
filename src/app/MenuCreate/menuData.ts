// TypeScript interfaces matching backend structure
export interface Category {
  id: number;
  name: string;
  imageUrl?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Item {
  id: number;
  businessId: number;
  name: string;
  description: string;
  imageUrl: string;
  basePrice: number;
  totalPrice: number;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
  allergens?: Allergen[];
}

export interface Allergen {
  id: number;
  name: string;
  createdAt: string;
  updatedAt: string;
  isSelected: boolean; // UI state only
}

export interface ItemAllergens {
  itemId: number;
  allergenId: number;
  createdAt: string;
  updatedAt: string;
}

// Keep existing interfaces for frontend-only features
export interface Ingredient {
  id: string;
  name: string;
  minAmount: number;
  maxAmount: number;
  pricePerUnit: number;
  isSelected: boolean;
  currentAmount: number;
  category: string;
  relevantFor: number[];
}

export interface Tag {
  id: string;
  name: string;
  isSelected: boolean;
  category: string;
}

export interface Size {
  id: string;
  name: string;
  additionalPrice: number;
  isDefault: boolean;
}

// New interface for category metadata
export interface CategoryType {
  id: number;
  name: string;
  type: "beverage" | "food";
  showSizes: boolean;
  showIngredients: boolean;
  showDrinks: boolean;
  showAllergens: boolean;
  showTags: boolean;
  defaultSizes: Size[];
}

// Backend-compatible mock data
export const defaultCategories: Category[] = [
  {
    id: 1,
    name: "Appetizers",
    imageUrl: null,
    createdAt: "2025-05-05T13:52:52.207+02:00",
    updatedAt: "2025-05-05T13:52:52.207+02:00",
  },
  {
    id: 2,
    name: "Main Courses",
    imageUrl: null,
    createdAt: "2025-05-05T13:52:52.208+02:00",
    updatedAt: "2025-05-05T13:52:52.208+02:00",
  },
  {
    id: 3,
    name: "Sides",
    imageUrl: null,
    createdAt: "2025-05-05T13:52:52.208+02:00",
    updatedAt: "2025-05-05T13:52:52.208+02:00",
  },
  {
    id: 4,
    name: "Desserts",
    imageUrl: null,
    createdAt: "2025-05-05T13:52:52.209+02:00",
    updatedAt: "2025-05-05T13:52:52.209+02:00",
  },
  {
    id: 5,
    name: "Beverages", // Renamed from "Drinks"
    imageUrl: null,
    createdAt: "2025-05-05T13:52:52.209+02:00",
    updatedAt: "2025-05-05T13:52:52.209+02:00",
  },
  {
    id: 6,
    name: "Vegan",
    imageUrl: null,
    createdAt: "2025-05-05T13:52:52.209+02:00",
    updatedAt: "2025-05-05T13:52:52.209+02:00",
  },
  {
    id: 7,
    name: "Vegetarian",
    imageUrl: null,
    createdAt: "2025-05-05T13:52:52.210+02:00",
    updatedAt: "2025-05-05T13:52:52.210+02:00",
  },
  {
    id: 8,
    name: "Spicy",
    imageUrl: null,
    createdAt: "2025-05-05T13:52:52.210+02:00",
    updatedAt: "2025-05-05T13:52:52.210+02:00",
  },
  {
    id: 9,
    name: "Seafood",
    imageUrl: null,
    createdAt: "2025-05-05T13:52:52.210+02:00",
    updatedAt: "2025-05-05T13:52:52.210+02:00",
  },
  {
    id: 10,
    name: "Specialty",
    imageUrl: null,
    createdAt: "2025-05-05T13:52:52.211+02:00",
    updatedAt: "2025-05-05T13:52:52.211+02:00",
  },
  {
    id: 11,
    name: "Pizza",
    imageUrl: null,
    createdAt: "2025-05-05T13:52:52.211+02:00",
    updatedAt: "2025-05-05T13:52:52.211+02:00",
  },
  {
    id: 12,
    name: "Pasta",
    imageUrl: null,
    createdAt: "2025-05-05T13:52:52.211+02:00",
    updatedAt: "2025-05-05T13:52:52.211+02:00",
  },
  {
    id: 13,
    name: "Salads",
    imageUrl: null,
    createdAt: "2025-05-05T13:52:52.212+02:00",
    updatedAt: "2025-05-05T13:52:52.212+02:00",
  },
  {
    id: 14,
    name: "Soups",
    imageUrl: null,
    createdAt: "2025-05-05T13:52:52.212+02:00",
    updatedAt: "2025-05-05T13:52:52.212+02:00",
  },
  {
    id: 15,
    name: "Breakfast",
    imageUrl: null,
    createdAt: "2025-05-05T13:52:52.212+02:00",
    updatedAt: "2025-05-05T13:52:52.212+02:00",
  },
  {
    id: 16,
    name: "Burgers",
    imageUrl: null,
    createdAt: "2025-05-05T13:52:52.212+02:00",
    updatedAt: "2025-05-05T13:52:52.212+02:00",
  },
];

export const defaultAllergens: Allergen[] = [
  {
    id: 1,
    name: "Gluten",
    createdAt: "2025-05-05T13:52:52.198+02:00",
    updatedAt: "2025-05-05T13:52:52.198+02:00",
    isSelected: false,
  },
  {
    id: 2,
    name: "Crustaceans",
    createdAt: "2025-05-05T13:52:52.200+02:00",
    updatedAt: "2025-05-05T13:52:52.200+02:00",
    isSelected: false,
  },
  {
    id: 3,
    name: "Eggs",
    createdAt: "2025-05-05T13:52:52.200+02:00",
    updatedAt: "2025-05-05T13:52:52.200+02:00",
    isSelected: false,
  },
  {
    id: 4,
    name: "Fish",
    createdAt: "2025-05-05T13:52:52.201+02:00",
    updatedAt: "2025-05-05T13:52:52.201+02:00",
    isSelected: false,
  },
  {
    id: 5,
    name: "Peanuts",
    createdAt: "2025-05-05T13:52:52.202+02:00",
    updatedAt: "2025-05-05T13:52:52.202+02:00",
    isSelected: false,
  },
  {
    id: 6,
    name: "Soybeans",
    createdAt: "2025-05-05T13:52:52.202+02:00",
    updatedAt: "2025-05-05T13:52:52.202+02:00",
    isSelected: false,
  },
  {
    id: 7,
    name: "Milk",
    createdAt: "2025-05-05T13:52:52.203+02:00",
    updatedAt: "2025-05-05T13:52:52.203+02:00",
    isSelected: false,
  },
  {
    id: 8,
    name: "Nuts",
    createdAt: "2025-05-05T13:52:52.204+02:00",
    updatedAt: "2025-05-05T13:52:52.204+02:00",
    isSelected: false,
  },
  {
    id: 9,
    name: "Celery",
    createdAt: "2025-05-05T13:52:52.204+02:00",
    updatedAt: "2025-05-05T13:52:52.204+02:00",
    isSelected: false,
  },
  {
    id: 10,
    name: "Mustard",
    createdAt: "2025-05-05T13:52:52.205+02:00",
    updatedAt: "2025-05-05T13:52:52.205+02:00",
    isSelected: false,
  },
  {
    id: 11,
    name: "Sesame",
    createdAt: "2025-05-05T13:52:52.205+02:00",
    updatedAt: "2025-05-05T13:52:52.205+02:00",
    isSelected: false,
  },
  {
    id: 12,
    name: "Sulphites",
    createdAt: "2025-05-05T13:52:52.205+02:00",
    updatedAt: "2025-05-05T13:52:52.205+02:00",
    isSelected: false,
  },
  {
    id: 13,
    name: "Lupin",
    createdAt: "2025-05-05T13:52:52.206+02:00",
    updatedAt: "2025-05-05T13:52:52.206+02:00",
    isSelected: false,
  },
  {
    id: 14,
    name: "Molluscs",
    createdAt: "2025-05-05T13:52:52.206+02:00",
    updatedAt: "2025-05-05T13:52:52.206+02:00",
    isSelected: false,
  },
];

// Keep existing ingredients for frontend features
export const defaultIngredients: Ingredient[] = [
  // Proteins
  {
    id: "1",
    name: "Beef",
    minAmount: 0,
    maxAmount: 3,
    pricePerUnit: 3.0,
    isSelected: false,
    currentAmount: 0,
    category: "protein",
    relevantFor: [2, 9, 10, 11, 12, 16], // Added relevant for Pizza and Pasta
  },
  {
    id: "2",
    name: "Chicken",
    minAmount: 0,
    maxAmount: 2,
    pricePerUnit: 2.5,
    isSelected: false,
    currentAmount: 0,
    category: "protein",
    relevantFor: [2, 3, 4, 9, 11, 13], // Added relevant for Pizza and Salads
  },
  {
    id: "3",
    name: "Sausage",
    minAmount: 0,
    maxAmount: 2,
    pricePerUnit: 2.75,
    isSelected: false,
    currentAmount: 0,
    category: "protein",
    relevantFor: [2, 11], // Added relevant for Pizza
  },
  {
    id: "4",
    name: "Ham",
    minAmount: 0,
    maxAmount: 2,
    pricePerUnit: 2.25,
    isSelected: false,
    currentAmount: 0,
    category: "protein",
    relevantFor: [1, 2, 3, 7, 11], // Added relevant for Appetizers, Sides, etc.
  },
  {
    id: "5",
    name: "Bacon",
    minAmount: 0,
    maxAmount: 4,
    pricePerUnit: 1.5,
    isSelected: false,
    currentAmount: 0,
    category: "protein",
    relevantFor: [1, 2, 3, 4, 7, 11, 16], // Added relevant for Pizza, Burgers
  },
  // Vegetables
  {
    id: "6",
    name: "Bell Peppers",
    minAmount: 0,
    maxAmount: 3,
    pricePerUnit: 0.75,
    isSelected: false,
    currentAmount: 0,
    category: "vegetable",
    relevantFor: [1, 2, 11, 13, 14], // Added relevant for Pizza, Salads, Soups
  },
  {
    id: "7",
    name: "Mushroom",
    minAmount: 0,
    maxAmount: 3,
    pricePerUnit: 1.0,
    isSelected: false,
    currentAmount: 0,
    category: "vegetable",
    relevantFor: [1, 2, 11, 12, 13], // Added relevant for Pizza, Pasta
  },
  {
    id: "8",
    name: "Onion",
    minAmount: 0,
    maxAmount: 3,
    pricePerUnit: 0.5,
    isSelected: false,
    currentAmount: 0,
    category: "vegetable",
    relevantFor: [1, 2, 3, 4, 7, 11, 16], // Added relevant for Pizza, Burgers
  },
  {
    id: "9",
    name: "Olives",
    minAmount: 0,
    maxAmount: 3,
    pricePerUnit: 0.8,
    isSelected: false,
    currentAmount: 0,
    category: "vegetable",
    relevantFor: [11, 13], // Added relevant for Pizza, Salads
  },
  // Cheese
  {
    id: "10",
    name: "Mozzarella",
    minAmount: 0,
    maxAmount: 2,
    pricePerUnit: 1.5,
    isSelected: false,
    currentAmount: 0,
    category: "cheese",
    relevantFor: [1, 2, 11, 12], // Added relevant for Pizza, Pasta
  },
  {
    id: "11",
    name: "Cheddar",
    minAmount: 0,
    maxAmount: 2,
    pricePerUnit: 1.25,
    isSelected: false,
    currentAmount: 0,
    category: "cheese",
    relevantFor: [16, 12, 2], // Added relevant for Burgers, Pasta
  },
  // Sauces
  {
    id: "12",
    name: "Tomato Sauce",
    minAmount: 1,
    maxAmount: 2,
    pricePerUnit: 0.0,
    isSelected: false,
    currentAmount: 0,
    category: "sauce",
    relevantFor: [11, 12, 14], // Added relevant for Pizza, Pasta, Soups
  },
  {
    id: "13",
    name: "Pesto",
    minAmount: 0,
    maxAmount: 2,
    pricePerUnit: 1.75,
    isSelected: false,
    currentAmount: 0,
    category: "sauce",
    relevantFor: [12], // Relevant for Pasta
  },
  // New drinks ingredients
  {
    id: "14",
    name: "Ice Cubes",
    minAmount: 0,
    maxAmount: 1,
    pricePerUnit: 0.25,
    isSelected: false,
    currentAmount: 0,
    category: "beverage_add-ons",
    relevantFor: [5], // Beverages category
  },
  {
    id: "15",
    name: "Lemon Slice",
    minAmount: 0,
    maxAmount: 2,
    pricePerUnit: 0.5,
    isSelected: false,
    currentAmount: 0,
    category: "beverage_add-ons",
    relevantFor: [5], // Beverages category
  },
];

// Keep existing tags for frontend features
export const defaultTags: Tag[] = [
  { id: "1", name: "Vegetarian", isSelected: false, category: "dietary" },
  { id: "2", name: "Vegan", isSelected: false, category: "dietary" },
  { id: "3", name: "Gluten-Free", isSelected: false, category: "dietary" },
  { id: "4", name: "Keto", isSelected: false, category: "dietary" },
  { id: "5", name: "Low-Carb", isSelected: false, category: "dietary" },
  { id: "6", name: "Spicy", isSelected: false, category: "style" },
  { id: "7", name: "Mild", isSelected: false, category: "style" },
  { id: "8", name: "Bestseller", isSelected: false, category: "popular" },
  { id: "9", name: "Chef's Special", isSelected: false, category: "popular" },
  { id: "10", name: "New Item", isSelected: false, category: "popular" },
];

// Keep existing sizes for frontend features
export const defaultSizes: Size[] = [
  { id: "1", name: "Regular", additionalPrice: 0, isDefault: true },
  { id: "2", name: "Large", additionalPrice: 3, isDefault: false },
  { id: "3", name: "Extra Large", additionalPrice: 5, isDefault: false },
  { id: "4", name: "Small", additionalPrice: -2, isDefault: false },
];

// New size data for beverage categories
export const beverageSizes: Size[] = [
  { id: "b1", name: "Small", additionalPrice: 0, isDefault: true },
  { id: "b2", name: "Medium", additionalPrice: 1.5, isDefault: false },
  { id: "b3", name: "Large", additionalPrice: 3, isDefault: false },
];

// New category metadata to define UI behavior
export const categoryMetadata: CategoryType[] = [
  {
    id: 11,
    name: "Pizza",
    type: "food",
    showSizes: true,
    showIngredients: true,
    showDrinks: true,
    showAllergens: true,
    showTags: true,
    defaultSizes: defaultSizes,
  },
  {
    id: 5,
    name: "Beverages",
    type: "beverage",
    showSizes: true,
    showIngredients: false,
    showDrinks: false,
    showAllergens: true,
    showTags: true,
    defaultSizes: beverageSizes,
  },
  {
    id: 16,
    name: "Burgers",
    type: "food",
    showSizes: true,
    showIngredients: true,
    showDrinks: true,
    showAllergens: true,
    showTags: true,
    defaultSizes: defaultSizes,
  },
];

// Helper function to get ingredients relevant to a specific category
export const getRelevantIngredients = (categoryId: number): Ingredient[] => {
  return defaultIngredients.filter((ingredient) =>
    ingredient.relevantFor.includes(categoryId)
  );
};

// Helper function to get ingredients grouped by their category type
export const getIngredientsByType = (): Record<string, Ingredient[]> => {
  const grouped: Record<string, Ingredient[]> = {};
  defaultIngredients.forEach((ingredient) => {
    if (!grouped[ingredient.category]) {
      grouped[ingredient.category] = [];
    }
    grouped[ingredient.category].push(ingredient);
  });
  return grouped;
};

// Get all ingredient categories for filtering
export const ingredientCategories = [
  "protein",
  "vegetable",
  "cheese",
  "sauce",
  "bread",
  "seasoning",
  "other",
  "beverage_add-ons", // New ingredient category
];
