"use client";
import { useState, useEffect } from "react";
import {
  defaultCategories,
  defaultIngredients,
  defaultAllergens,
  defaultTags,
  defaultSizes,
  beverageSizes,
  categoryMetadata,
  getRelevantIngredients,
  getIngredientsByType,
  ingredientCategories,
  type Category,
  type Ingredient,
  type Allergen,
  type Tag,
  type Size,
  type CategoryType,
} from "./menuData";
import { saveMenuItem, updateMenuItem } from "../menuManager/menuStorage";
import "./MenuCreate.css";

interface StoredMenuItem {
  id: string;
  businessId: number;
  categoryId: number;
  name: string;
  description: string;
  imageUrl: string;
  images?: string[]; // Added support for multiple images
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

interface MenuCreateProps {
  removeBg: (value: boolean) => void;
  editingItem?: StoredMenuItem | null;
}

export default function MenuCreate({ removeBg, editingItem }: MenuCreateProps) {
  // Updated to handle multiple images from editing item
  const [images, setImages] = useState<string[]>(() => {
    if (editingItem?.images && editingItem.images.length > 0) {
      return editingItem.images;
    }
    if (editingItem?.imageUrl) {
      return [editingItem.imageUrl];
    }
    return [];
  });

  const [toast, setToast] = useState<{
    show: boolean;
    message: string;
    type: "success" | "error";
  }>({ show: false, message: "", type: "success" });

  const [categories, setCategories] = useState<Category[]>(defaultCategories);
  const [selectedCategory, setSelectedCategory] = useState<number | null>(
    editingItem?.categoryId || null
  );
  const [newCategoryName, setNewCategoryName] = useState<string>("");
  const [showAddCategory, setShowAddCategory] = useState<boolean>(false);
  const [editingCategory, setEditingCategory] = useState<boolean>(false);

  const [basePrice, setBasePrice] = useState<number>(
    editingItem?.basePrice || 9
  );
  const [maxOrderAmount, setMaxOrderAmount] = useState<number>(100);

  const [sizes, setSizes] = useState<Size[]>(
    editingItem?.sizes ? editingItem.sizes : defaultSizes
  );
  const [originalSizeOrder, setOriginalSizeOrder] =
    useState<Size[]>(defaultSizes);
  const [newSizeName, setNewSizeName] = useState<string>("");
  const [newSizePrice, setNewSizePrice] = useState<number>(0);
  const [categoryType, setCategoryType] = useState<"food" | "beverage" | null>(
    null
  );

  const [availableIngredients, setAvailableIngredients] = useState<
    Ingredient[]
  >(() => {
    if (editingItem?.ingredients) {
      return defaultIngredients.map((ingredient) => {
        const editingIngredient = editingItem.ingredients.find(
          (ing) => ing.id === ingredient.id
        );
        if (editingIngredient) {
          return {
            ...ingredient,
            isSelected: true,
            currentAmount: editingIngredient.currentAmount,
          };
        }
        return { ...ingredient, isSelected: false, currentAmount: 0 };
      });
    }
    return defaultIngredients;
  });
  const [showAddIngredient, setShowAddIngredient] = useState<boolean>(false);
  const [newIngredientName, setNewIngredientName] = useState<string>("");
  const [newIngredientPrice, setNewIngredientPrice] = useState<number>(0);
  const [newIngredientMaxAmount, setNewIngredientMaxAmount] =
    useState<number>(3);
  const [showAllIngredients, setShowAllIngredients] = useState<boolean>(false);

  // Drinks specific states
  const [showAllDrinks, setShowAllDrinks] = useState<boolean>(false);
  const [availableDrinks, setAvailableDrinks] = useState<Ingredient[]>(
    defaultIngredients.filter((ing) => ing.category === "beverage_add-ons")
  );

  const [availableAllergens, setAvailableAllergens] =
    useState<Allergen[]>(defaultAllergens);
  const [showAllergenDropdown, setShowAllergenDropdown] =
    useState<boolean>(false);
  const [newAllergenName, setNewAllergenName] = useState<string>("");
  const [showAddAllergen, setShowAddAllergen] = useState<boolean>(false);

  const [availableTags, setAvailableTags] = useState<Tag[]>(() => {
    if (editingItem?.tags) {
      return defaultTags.map((tag) => ({
        ...tag,
        isSelected: editingItem.tags.includes(tag.name),
      }));
    }
    return defaultTags;
  });
  const [showAddTag, setShowAddTag] = useState<boolean>(false);
  const [newTagName, setNewTagName] = useState<string>("");

  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const getCategoryMetaData = (
    categoryId: number | null
  ): CategoryType | undefined => {
    if (categoryId === null) return undefined;
    return categoryMetadata.find((cat) => cat.id === categoryId);
  };

  const resetSizesToDefault = () => {
    const metadata = getCategoryMetaData(selectedCategory);
    if (metadata) {
      setSizes(metadata.defaultSizes);
    } else {
      setSizes(originalSizeOrder);
    }
  };

  const handleCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const categoryId = e.target.value ? parseInt(e.target.value) : null;
    setSelectedCategory(categoryId);

    if (categoryId !== null) {
      const metadata = getCategoryMetaData(categoryId);
      if (metadata) {
        setCategoryType(metadata.type);
        setSizes(metadata.defaultSizes);
        setOriginalSizeOrder(metadata.defaultSizes);
        setAvailableIngredients(
          defaultIngredients.map((ing) => ({
            ...ing,
            isSelected: false,
            currentAmount: 0,
          }))
        );
      }
    } else {
      setCategoryType(null);
      setSizes(defaultSizes);
      setOriginalSizeOrder(defaultSizes);
    }
  };

  useEffect(() => {
    if (toast.show) {
      const timer = setTimeout(() => {
        setToast((prev) => ({ ...prev, show: false }));
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [toast.show]);

  useEffect(() => {
    if (editingItem && editingItem.categoryId) {
      const metadata = getCategoryMetaData(editingItem.categoryId);
      if (metadata) {
        setCategoryType(metadata.type);
        setOriginalSizeOrder(metadata.defaultSizes);
      }
    } else {
      setOriginalSizeOrder(defaultSizes);
    }
  }, [editingItem]);

  const compressImage = (
    file: File,
    maxWidth = 1000,
    quality = 0.8
  ): Promise<string> => {
    return new Promise((resolve) => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d")!;
      const img = new Image();

      img.onload = () => {
        const ratio = Math.min(maxWidth / img.width, maxWidth / img.height);
        canvas.width = img.width * ratio;
        canvas.height = img.height * ratio;

        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };

      img.src = URL.createObjectURL(file);
    });
  };

  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      for (const file of Array.from(files)) {
        const compressedImage = await compressImage(file);
        setImages((prev) => [...prev, compressedImage]);
      }
    }
  };

  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const formData = new FormData(e.currentTarget);
    const name = formData.get("name") as string;
    const description = formData.get("description") as string;

    if (!name?.trim()) {
      setToast({
        show: true,
        message: "Please enter a dish name",
        type: "error",
      });
      return;
    }

    if (!selectedCategory) {
      setToast({
        show: true,
        message: "Please select a category",
        type: "error",
      });
      return;
    }

    if (images.length === 0) {
      setToast({
        show: true,
        message: "Please upload at least one image",
        type: "error",
      });
      return;
    }

    const selectedIngredients = getSelectedIngredients();
    const ingredientPrice = selectedIngredients.reduce(
      (sum, ingredient) =>
        sum +
        ingredient.pricePerUnit *
          Math.max(0, ingredient.currentAmount - ingredient.minAmount),
      0
    );

    const totalPrice = basePrice + ingredientPrice;

    // Updated to include all images
    const menuItemData = {
      businessId: 1,
      categoryId: selectedCategory,
      name: name.trim(),
      description: description?.trim() || "",
      imageUrl: images[0] || "", // Keep for backward compatibility
      images: images, // Store ALL images
      basePrice,
      totalPrice,
      enabled: editingItem ? editingItem.enabled : true,
      sizes: sizes.map((size) => ({
        id: size.id,
        name: size.name,
        additionalPrice: size.additionalPrice,
        isDefault: size.isDefault,
      })),
      ingredients: selectedIngredients.map((ingredient) => ({
        id: ingredient.id,
        name: ingredient.name,
        minAmount: ingredient.minAmount,
        maxAmount: ingredient.maxAmount,
        pricePerUnit: ingredient.pricePerUnit,
        currentAmount: ingredient.currentAmount,
      })),
      tags: getSelectedTags().map((tag) => tag.name),
    };

    try {
      if (editingItem) {
        updateMenuItem(editingItem.id, menuItemData);
        setToast({
          show: true,
          message: "Menu item updated successfully!",
          type: "success",
        });
      } else {
        saveMenuItem(menuItemData);
        setToast({
          show: true,
          message: "Menu item created successfully!",
          type: "success",
        });
      }

      setTimeout(() => {
        removeBg(false);
      }, 1500);
    } catch (error) {
      console.error("Failed to save menu item:", error);
      setToast({
        show: true,
        message: `Failed to ${
          editingItem ? "update" : "create"
        } menu item. Please try again.`,
        type: "error",
      });
    }
  };

  const changeVis = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) removeBg(false);
  };

  const addCategory = () => {
    if (newCategoryName.trim()) {
      if (editingCategory && selectedCategory !== null) {
        setCategories(
          categories.map((cat) =>
            cat.id === selectedCategory
              ? { ...cat, name: newCategoryName.trim() }
              : cat
          )
        );
        setEditingCategory(false);
      } else {
        const newId = Math.max(...categories.map((c) => c.id), 0) + 1;
        const newCategory: Category = {
          id: newId,
          name: newCategoryName.trim(),
          imageUrl: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        setCategories([...categories, newCategory]);
      }
      setNewCategoryName("");
      setShowAddCategory(false);
    }
  };

  const startEditCategory = () => {
    const category = categories.find((cat) => cat.id === selectedCategory);
    if (category) {
      setEditingCategory(true);
      setNewCategoryName(category.name);
      setShowAddCategory(true);
    }
  };

  const removeCategory = () => {
    if (selectedCategory !== null) {
      setCategories(categories.filter((cat) => cat.id !== selectedCategory));
      setSelectedCategory(null);
    }
  };

  const handleAddSize = () => {
    if (newSizeName.trim()) {
      const newItem = {
        id: `size-${Date.now()}`,
        name: newSizeName,
        additionalPrice: newSizePrice,
        isDefault: false,
      };
      setSizes([...sizes, newItem]);
      setNewSizeName("");
      setNewSizePrice(0);
    }
  };

  const handleSizeNameChange = (id: string, newName: string) => {
    setSizes(
      sizes.map((size) => (size.id === id ? { ...size, name: newName } : size))
    );
  };

  const handleRemoveSize = (id: string) => {
    setSizes(sizes.filter((size) => size.id !== id));
  };

  const toggleIngredient = (id: string) => {
    setAvailableIngredients(
      availableIngredients.map((ingredient) =>
        ingredient.id === id
          ? {
              ...ingredient,
              isSelected: !ingredient.isSelected,
              currentAmount: !ingredient.isSelected
                ? Math.max(1, ingredient.minAmount)
                : 0,
            }
          : ingredient
      )
    );
  };

  const updateIngredientAmount = (id: string, amount: number) => {
    setAvailableIngredients(
      availableIngredients.map((ingredient) =>
        ingredient.id === id
          ? {
              ...ingredient,
              currentAmount: Math.max(
                ingredient.minAmount,
                Math.min(ingredient.maxAmount, amount)
              ),
            }
          : ingredient
      )
    );
  };

  const addNewIngredient = () => {
    if (newIngredientName.trim()) {
      const newIngredient: Ingredient = {
        id: `ingredient-${Date.now()}`,
        name: newIngredientName.trim(),
        minAmount: 0,
        maxAmount: newIngredientMaxAmount,
        pricePerUnit: newIngredientPrice,
        isSelected: false,
        currentAmount: 0,
        category: "custom",
        relevantFor: selectedCategory ? [selectedCategory] : [],
      };
      setAvailableIngredients([...availableIngredients, newIngredient]);
      setNewIngredientName("");
      setNewIngredientPrice(0);
      setNewIngredientMaxAmount(3);
      setShowAddIngredient(false);
    }
  };

  const clearAllIngredients = () => {
    setAvailableIngredients(
      availableIngredients.map((ingredient) => ({
        ...ingredient,
        isSelected: false,
        currentAmount: 0,
      }))
    );
  };

  const getSelectedIngredients = () =>
    availableIngredients.filter((ingredient) => ingredient.isSelected);

  const getRelevantIngredientsForCategory = () => {
    if (selectedCategory === null) return [];
    return availableIngredients.filter((ingredient) =>
      ingredient.relevantFor.includes(selectedCategory)
    );
  };

  const getGroupedNonRelevantIngredients = () => {
    if (selectedCategory === null) return getIngredientsByType();

    const relevantIds = getRelevantIngredientsForCategory().map(
      (ing) => ing.id
    );
    const nonRelevant = availableIngredients.filter(
      (ingredient) => !relevantIds.includes(ingredient.id)
    );

    const grouped: Record<string, Ingredient[]> = {};
    nonRelevant.forEach((ingredient) => {
      if (!grouped[ingredient.category]) {
        grouped[ingredient.category] = [];
      }
      grouped[ingredient.category].push(ingredient);
    });
    return grouped;
  };

  const getIngredientsByCategory = (category: string) => {
    return availableIngredients.filter((ing) => ing.category === category);
  };

  const toggleAllergen = (id: number) => {
    setAvailableAllergens(
      availableAllergens.map((allergen) =>
        allergen.id === id
          ? { ...allergen, isSelected: !allergen.isSelected }
          : allergen
      )
    );
  };

  const addNewAllergen = () => {
    if (newAllergenName.trim()) {
      const newId = Math.max(...availableAllergens.map((a) => a.id), 0) + 1;
      const newAllergen: Allergen = {
        id: newId,
        name: newAllergenName.trim(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isSelected: false,
      };
      setAvailableAllergens([...availableAllergens, newAllergen]);
      setNewAllergenName("");
      setShowAddAllergen(false);
    }
  };

  const clearAllAllergens = () => {
    setAvailableAllergens(
      availableAllergens.map((allergen) => ({ ...allergen, isSelected: false }))
    );
  };

  const getSelectedAllergens = () =>
    availableAllergens.filter((allergen) => allergen.isSelected);

  const toggleTag = (id: string) => {
    setAvailableTags(
      availableTags.map((tag) =>
        tag.id === id ? { ...tag, isSelected: !tag.isSelected } : tag
      )
    );
  };

  const addNewTag = () => {
    if (newTagName.trim()) {
      const newTag = {
        id: `tag-${Date.now()}`,
        name: newTagName.trim(),
        isSelected: true,
        category: "custom",
      };
      setAvailableTags([...availableTags, newTag]);
      setNewTagName("");
      setShowAddTag(false);
    }
  };

  const clearAllTags = () => {
    setAvailableTags(
      availableTags.map((tag) => ({ ...tag, isSelected: false }))
    );
  };

  const getSelectedTags = () => availableTags.filter((tag) => tag.isSelected);

  const handleDragStart = (e: React.DragEvent, index: number) => {
    if (sizes[index].isDefault) {
      e.preventDefault();
      return;
    }
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (sizes[index].isDefault) return;
    setDragOverIndex(index);
    e.dataTransfer.dropEffect = "move";
  };

  const handleDragLeave = () => setDragOverIndex(null);

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (
      draggedIndex === null ||
      sizes[dropIndex].isDefault ||
      draggedIndex === dropIndex
    ) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }

    const newSizes = [...sizes];
    [newSizes[draggedIndex], newSizes[dropIndex]] = [
      newSizes[dropIndex],
      newSizes[draggedIndex],
    ];

    setSizes(newSizes);
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const currentCategoryMetadata = getCategoryMetaData(selectedCategory);

  return (
    <div className="menu-modal-overlay" onClick={changeVis}>
      <div className={`menu-toast ${toast.show ? "show" : ""} ${toast.type}`}>
        <div className="menu-toast-content">
          <span className="menu-toast-icon">
            {toast.type === "success" ? "✓" : "⚠"}
          </span>
          <span className="menu-toast-message">{toast.message}</span>
        </div>
      </div>

      <div className="menu-modal-content">
        <button
          onClick={() => removeBg(false)}
          className="menu-modal-close"
          type="button"
          aria-label="Close modal"
        >
          ×
        </button>
        <form className="menu-form" onSubmit={handleSubmit}>
          <div className="menu-form-section">
            {!showAddCategory ? (
              <>
                <div className="menu-category-header">
                  <label className="menu-form-label">Category</label>
                  <button
                    type="button"
                    className="menu-button-add"
                    onClick={() => setShowAddCategory(true)}
                  >
                    Add New Category
                  </button>
                </div>
                <div className="menu-category-selection">
                  <select
                    className="menu-form-select"
                    value={selectedCategory || ""}
                    onChange={handleCategoryChange}
                  >
                    <option value="">Select Category</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                  {categoryType && (
                    <span
                      className={`menu-category-type-indicator ${categoryType}`}
                    >
                      {categoryType.charAt(0).toUpperCase() +
                        categoryType.slice(1)}
                    </span>
                  )}
                </div>
                {selectedCategory && (
                  <div className="menu-category-actions">
                    <button
                      type="button"
                      className="menu-button-edit"
                      onClick={startEditCategory}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="menu-button-delete"
                      onClick={removeCategory}
                    >
                      Delete
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className="menu-category-form">
                <h4 className="menu-category-title">
                  {editingCategory ? "Edit Category" : "Add New Category"}
                </h4>
                <input
                  type="text"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  className="menu-form-input"
                  placeholder="Enter category name"
                />
                <div className="menu-form-buttons">
                  <button
                    type="button"
                    onClick={addCategory}
                    className="menu-button-save"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddCategory(false);
                      setEditingCategory(false);
                      setNewCategoryName("");
                    }}
                    className="menu-button-cancel"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="menu-form-section">
            <label htmlFor="dish-name" className="menu-form-label">
              Name of dish
            </label>
            <input
              type="text"
              name="name"
              id="dish-name"
              className="menu-form-input"
              placeholder="Enter name of dish"
              defaultValue={editingItem?.name || ""}
              required
            />
          </div>

          <div className="menu-form-section menu-image-section">
            <label className="menu-form-label">Images *</label>
            <input
              id="menu-file-upload"
              type="file"
              accept="image/*"
              multiple
              className="menu-file-input"
              style={{ display: "none" }}
              onChange={handleFileChange}
            />
            <label htmlFor="menu-file-upload" className="menu-upload-label">
              <img src="/upload.svg" alt="Upload icon" width="48" height="48" />
              <p className="menu-upload-text">Click to upload images</p>
              <p className="menu-upload-subtext">Multiple images allowed</p>
            </label>
            {images.length > 0 && (
              <div className="menu-images-preview">
                <h3 className="menu-preview-title">
                  Uploaded Images ({images.length}):
                </h3>
                <div className="menu-images-grid">
                  {images.map((imageSrc: string, index: number) => (
                    <div key={index} className="menu-image-preview-item">
                      <img
                        src={imageSrc}
                        alt={`Menu item ${index + 1}`}
                        className="menu-preview-image"
                      />
                      <button
                        type="button"
                        className="menu-remove-image-btn"
                        onClick={() => removeImage(index)}
                        aria-label={`Remove image ${index + 1}`}
                      >
                        ×
                      </button>
                      {index === 0 && (
                        <span className="menu-main-image-badge">Main</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="menu-form-section menu-price-section">
            <div className="menu-price-group">
              <label className="menu-form-label">Base Price (USD)</label>
              <input
                type="number"
                name="price"
                className="menu-form-input menu-price-input"
                placeholder="Price"
                min="0"
                step="1"
                value={basePrice}
                onChange={(e) => setBasePrice(parseFloat(e.target.value) || 0)}
                required
              />
            </div>
            <div className="menu-order-group">
              <label className="menu-form-label">Max Order Amount</label>
              <input
                type="number"
                name="maxAmount"
                className="menu-form-input menu-order-input"
                placeholder="Max quantity"
                min="1"
                value={maxOrderAmount}
                onChange={(e) =>
                  setMaxOrderAmount(parseInt(e.target.value) || 1)
                }
              />
            </div>
          </div>

          <div className="menu-form-section">
            <label htmlFor="menu-description" className="menu-form-label">
              Description
            </label>
            <textarea
              name="description"
              id="menu-description"
              className="menu-form-textarea"
              placeholder="Describe your dish here..."
              defaultValue={editingItem?.description || ""}
            ></textarea>
          </div>

          <div
            className={`menu-form-section ${
              currentCategoryMetadata?.showSizes === false
                ? "menu-section-hidden"
                : ""
            }`}
          >
            <div className="menu-size-header">
              <label className="menu-form-label">Size Options</label>
              <div className="menu-size-info">
                <span className="menu-info-text">
                  Total base price: USD {basePrice.toFixed(2)}
                </span>
                <button
                  type="button"
                  onClick={resetSizesToDefault}
                  className="menu-size-reset-button"
                  aria-label="Reset sizes to default"
                >
                  Reset
                </button>
              </div>
            </div>

            {sizes.length === 1 && (
              <div className="menu-size-error">❗ Only one size available.</div>
            )}

            <div className="menu-sizes-container">
              {sizes.map((size, index) => (
                <div
                  key={size.id}
                  className={`menu-size-item ${
                    !size.isDefault ? "menu-size-draggable" : ""
                  } ${dragOverIndex === index ? "menu-size-dragover" : ""}`}
                  draggable={!size.isDefault}
                  onDragStart={(e) => handleDragStart(e, index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, index)}
                  onDragEnd={handleDragEnd}
                >
                  {!size.isDefault && (
                    <div className="menu-drag-handle">⋮⋮</div>
                  )}

                  <input
                    type="text"
                    value={size.name}
                    onChange={(e) =>
                      handleSizeNameChange(size.id, e.target.value)
                    }
                    className={`menu-form-input menu-size-name ${
                      size.isDefault ? "menu-size-default" : ""
                    }`}
                    disabled={size.isDefault}
                  />
                  <div className="menu-size-price">
                    {size.isDefault ? (
                      <span className="menu-total-price">
                        USD {basePrice.toFixed(2)}
                      </span>
                    ) : (
                      <>
                        <input
                          type="number"
                          value={size.additionalPrice}
                          className="menu-form-input menu-addon-price"
                          disabled={size.isDefault}
                          onChange={(e) => {
                            const price = parseFloat(e.target.value) || 0;
                            setSizes(
                              sizes.map((s) =>
                                s.id === size.id
                                  ? { ...s, additionalPrice: price }
                                  : s
                              )
                            );
                          }}
                        />
                        <span className="menu-total-price">
                          = USD {(basePrice + size.additionalPrice).toFixed(2)}
                        </span>
                      </>
                    )}
                  </div>
                  {!size.isDefault && (
                    <button
                      type="button"
                      onClick={() => handleRemoveSize(size.id)}
                      className="menu-remove-button"
                      aria-label="Remove size"
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
            </div>

            <div className="menu-add-size-container">
              <input
                type="text"
                value={newSizeName}
                onChange={(e) => setNewSizeName(e.target.value)}
                placeholder="Size name"
                className="menu-form-input"
              />
              <div className="menu-size-price-input">
                <span className="menu-price-prefix">+USD</span>
                <input
                  type="number"
                  value={newSizePrice}
                  onChange={(e) =>
                    setNewSizePrice(parseFloat(e.target.value) || 0)
                  }
                  placeholder="Additional price"
                  className="menu-form-input menu-addon-input"
                  min="0"
                  step="1"
                />
              </div>
              <button
                type="button"
                onClick={handleAddSize}
                className="menu-button-add-full"
              >
                Add Size
              </button>
            </div>
          </div>

          <div
            className={`menu-form-section ${
              currentCategoryMetadata?.showIngredients === false
                ? "menu-section-hidden"
                : ""
            }`}
          >
            <div className="menu-ingredients-header">
              <label className="menu-form-label">Ingredients</label>
              <button
                type="button"
                onClick={clearAllIngredients}
                className="menu-button-clear"
              >
                Clear all
              </button>
            </div>
            <p className="menu-info-text">
              Select and customize the ingredients for your dish.
            </p>
            <div className="menu-ingredients-container">
              <div className="menu-relevant-ingredients">
                <h4 className="menu-category-title">
                  Suggested for this dish:
                </h4>
                {getRelevantIngredientsForCategory().map((ingredient) => (
                  <div key={ingredient.id} className="menu-ingredient-item">
                    <div className="menu-ingredient-checkbox">
                      <input
                        type="checkbox"
                        checked={ingredient.isSelected}
                        onChange={() => toggleIngredient(ingredient.id)}
                        className="menu-checkbox"
                        id={`ingredient-${ingredient.id}`}
                      />
                      <label
                        htmlFor={`ingredient-${ingredient.id}`}
                        className="menu-ingredient-name"
                      >
                        {ingredient.name}
                      </label>
                    </div>
                    {ingredient.isSelected && (
                      <div className="menu-ingredient-controls">
                        <span className="menu-ingredient-limits">
                          Min: {ingredient.minAmount}, Max:{" "}
                          {ingredient.maxAmount}
                        </span>
                        <div className="menu-amount-control">
                          <button
                            type="button"
                            onClick={() =>
                              updateIngredientAmount(
                                ingredient.id,
                                ingredient.currentAmount - 1
                              )
                            }
                            disabled={
                              ingredient.currentAmount <= ingredient.minAmount
                            }
                            className="menu-amount-button"
                          >
                            -
                          </button>
                          <span className="menu-ingredient-amount">
                            {ingredient.currentAmount}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              updateIngredientAmount(
                                ingredient.id,
                                ingredient.currentAmount + 1
                              )
                            }
                            disabled={
                              ingredient.currentAmount >= ingredient.maxAmount
                            }
                            className="menu-amount-button"
                          >
                            +
                          </button>
                        </div>
                        <span className="menu-ingredient-price">
                          + USD {ingredient.pricePerUnit.toFixed(2)}
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <div className="menu-ingredients-dropdown">
                <button
                  type="button"
                  onClick={() => setShowAllIngredients(!showAllIngredients)}
                  className="menu-dropdown-toggle"
                >
                  <span>More Ingredients...</span>
                  <span
                    className={`menu-dropdown-arrow ${
                      showAllIngredients ? "open" : ""
                    }`}
                  >
                    ▼
                  </span>
                </button>
                {showAllIngredients && (
                  <div className="menu-other-ingredients-list">
                    {Object.keys(getGroupedNonRelevantIngredients()).map(
                      (category) => (
                        <div
                          key={category}
                          className="menu-ingredient-category"
                        >
                          <h4 className="menu-ingredient-category-title">
                            {category.charAt(0).toUpperCase() +
                              category.slice(1)}
                          </h4>
                          {getGroupedNonRelevantIngredients()[category].map(
                            (ingredient) => (
                              <div
                                key={ingredient.id}
                                className="menu-ingredient-item"
                              >
                                <div className="menu-ingredient-checkbox">
                                  <input
                                    type="checkbox"
                                    checked={ingredient.isSelected}
                                    onChange={() =>
                                      toggleIngredient(ingredient.id)
                                    }
                                    className="menu-checkbox"
                                    id={`ingredient-${ingredient.id}`}
                                  />
                                  <label
                                    htmlFor={`ingredient-${ingredient.id}`}
                                    className="menu-ingredient-name"
                                  >
                                    {ingredient.name}
                                  </label>
                                </div>
                                {ingredient.isSelected && (
                                  <div className="menu-ingredient-controls">
                                    <span className="menu-ingredient-limits">
                                      Min: {ingredient.minAmount}, Max:{" "}
                                      {ingredient.maxAmount}
                                    </span>
                                    <div className="menu-amount-control">
                                      <button
                                        type="button"
                                        onClick={() =>
                                          updateIngredientAmount(
                                            ingredient.id,
                                            ingredient.currentAmount - 1
                                          )
                                        }
                                        disabled={
                                          ingredient.currentAmount <=
                                          ingredient.minAmount
                                        }
                                        className="menu-amount-button"
                                      >
                                        -
                                      </button>
                                      <span className="menu-ingredient-amount">
                                        {ingredient.currentAmount}
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          updateIngredientAmount(
                                            ingredient.id,
                                            ingredient.currentAmount + 1
                                          )
                                        }
                                        disabled={
                                          ingredient.currentAmount >=
                                          ingredient.maxAmount
                                        }
                                        className="menu-amount-button"
                                      >
                                        +
                                      </button>
                                    </div>
                                    <span className="menu-ingredient-price">
                                      + USD {ingredient.pricePerUnit.toFixed(2)}
                                    </span>
                                  </div>
                                )}
                              </div>
                            )
                          )}
                        </div>
                      )
                    )}
                  </div>
                )}
              </div>
              <div className="menu-add-ingredient-form">
                <h4 className="menu-category-title">Add Custom Ingredient</h4>
                <input
                  type="text"
                  value={newIngredientName}
                  onChange={(e) => setNewIngredientName(e.target.value)}
                  placeholder="Ingredient name"
                  className="menu-form-input"
                />
                <div className="menu-size-price-input">
                  <span className="menu-price-prefix">+USD</span>
                  <input
                    type="number"
                    value={newIngredientPrice}
                    onChange={(e) =>
                      setNewIngredientPrice(parseFloat(e.target.value) || 0)
                    }
                    placeholder="Price per unit"
                    className="menu-form-input menu-addon-input"
                    min="0"
                    step="0.01"
                  />
                  <input
                    type="number"
                    value={newIngredientMaxAmount}
                    onChange={(e) =>
                      setNewIngredientMaxAmount(parseInt(e.target.value) || 1)
                    }
                    placeholder="Max"
                    className="menu-form-input menu-addon-input"
                    min="1"
                    max="10"
                  />
                </div>
                <button
                  type="button"
                  onClick={addNewIngredient}
                  className="menu-button-add-full"
                >
                  Add
                </button>
              </div>
            </div>
          </div>

          <div
            className={`menu-form-section menu-drinks-section ${
              currentCategoryMetadata?.showDrinks === false
                ? "menu-section-hidden"
                : ""
            }`}
          >
            <div className="menu-ingredients-header">
              <label className="menu-form-label">Drinks (Add-ons)</label>
              <button
                type="button"
                onClick={() =>
                  setAvailableDrinks(
                    availableDrinks.map((d) => ({ ...d, isSelected: false }))
                  )
                }
                className="menu-button-clear"
              >
                Clear all
              </button>
            </div>
            <p className="menu-info-text">
              Select beverages to include as an option.
            </p>
            <div className="menu-ingredients-container">
              {getIngredientsByCategory("beverage_add-ons").map((drink) => (
                <div key={drink.id} className="menu-ingredient-item">
                  <div className="menu-ingredient-checkbox">
                    <input
                      type="checkbox"
                      checked={drink.isSelected}
                      onChange={() => toggleIngredient(drink.id)}
                      className="menu-checkbox"
                      id={`drink-${drink.id}`}
                    />
                    <label
                      htmlFor={`drink-${drink.id}`}
                      className="menu-ingredient-name"
                    >
                      {drink.name}
                    </label>
                  </div>
                  {drink.isSelected && (
                    <div className="menu-ingredient-controls">
                      <span className="menu-ingredient-price">
                        + USD {drink.pricePerUnit.toFixed(2)}
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div
            className={`menu-form-section ${
              currentCategoryMetadata?.showAllergens === false
                ? "menu-section-hidden"
                : ""
            }`}
          >
            <div className="menu-allergens-header">
              <label className="menu-form-label">Allergens</label>
              <button
                type="button"
                onClick={clearAllAllergens}
                className="menu-button-clear"
              >
                Clear All
              </button>
            </div>
            <div className="menu-allergens-dropdown-container">
              <button
                type="button"
                onClick={() => setShowAllergenDropdown(!showAllergenDropdown)}
                className="menu-allergens-dropdown-header"
              >
                <span className="menu-selected-allergens-preview">
                  {getSelectedAllergens().length > 0
                    ? getSelectedAllergens()
                        .map((a) => a.name)
                        .join(", ")
                    : "Select allergens"}
                </span>
                <span
                  className={`menu-dropdown-arrow ${
                    showAllergenDropdown ? "open" : ""
                  }`}
                >
                  ▼
                </span>
              </button>
              {showAllergenDropdown && (
                <div className="menu-allergens-dropdown-list">
                  {availableAllergens.map((allergen) => (
                    <div
                      key={allergen.id}
                      className="menu-checkbox-item"
                      onClick={() => toggleAllergen(allergen.id)}
                    >
                      <input
                        type="checkbox"
                        checked={allergen.isSelected}
                        onChange={() => toggleAllergen(allergen.id)}
                        className="menu-checkbox"
                        id={`allergen-${allergen.id}`}
                      />
                      <label htmlFor={`allergen-${allergen.id}`}>
                        {allergen.name}
                      </label>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="menu-add-allergen-form">
              <h4 className="menu-category-title">Add Custom Allergen</h4>
              <input
                type="text"
                value={newAllergenName}
                onChange={(e) => setNewAllergenName(e.target.value)}
                placeholder="Allergen name"
                className="menu-form-input"
              />
              <button
                type="button"
                onClick={addNewAllergen}
                className="menu-button-add-full"
              >
                Add
              </button>
            </div>
          </div>

          <div
            className={`menu-form-section ${
              currentCategoryMetadata?.showTags === false
                ? "menu-section-hidden"
                : ""
            }`}
          >
            <div className="menu-tags-header">
              <label className="menu-form-label">Tags</label>
              <button
                type="button"
                onClick={clearAllTags}
                className="menu-button-clear"
              >
                Clear All
              </button>
            </div>
            <div className="menu-tags-container">
              {availableTags.map((tag) => (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => toggleTag(tag.id)}
                  className={`menu-tag-button ${
                    tag.isSelected ? "selected" : ""
                  }`}
                >
                  {tag.name}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setShowAddTag(true)}
                className="menu-add-tag-button"
              >
                + Add Tag
              </button>
            </div>
            {showAddTag && (
              <div className="menu-add-tag-form">
                <input
                  type="text"
                  value={newTagName}
                  onChange={(e) => setNewTagName(e.target.value)}
                  placeholder="Tag name"
                  className="menu-form-input"
                />
                <button
                  type="button"
                  onClick={addNewTag}
                  className="menu-button-add-full"
                >
                  Add
                </button>
              </div>
            )}
          </div>

          <button type="submit" className="menu-submit-button">
            {editingItem ? "Update Menu Item" : "Create Menu Item"}
          </button>
        </form>
      </div>
    </div>
  );
}