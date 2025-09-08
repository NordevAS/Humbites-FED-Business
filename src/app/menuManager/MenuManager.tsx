"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import {
  getMenuItems,
  deleteMenuItem,
  toggleItemEnabled,
  searchMenuItems,
  getItemsByCategory,
  getMenuStats,
} from "./menuStorage";
import { defaultCategories } from "../MenuCreate/menuData";
import "./MenuManager.css";
import NavBar from "../../../src/components/Layout/Header/NavBar";
import "../main.css";
import MenuCreate from "../MenuCreate/MenuCreate";

interface StoredMenuItem {
  id: string;
  businessId: number;
  categoryId: number;
  name: string;
  description: string;
  imageUrl: string;
  images?: string[]; // New field for multiple images
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

// Image Carousel Component
const ImageCarousel: React.FC<{
  images: string[];
  itemName: string;
}> = ({ images, itemName }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const startAutoScroll = () => {
    if (images.length > 1) {
      intervalRef.current = setInterval(() => {
        setCurrentIndex((prevIndex) =>
          prevIndex === images.length - 1 ? 0 : prevIndex + 1
        );
      }, 5000); // 5-second interval for automatic scroll
    }
  };

  const stopAutoScroll = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
  };

  useEffect(() => {
    startAutoScroll();
    return () => stopAutoScroll(); // Clean up on component unmount
  }, [images.length]);

  const goToPrevious = (e: React.MouseEvent) => {
    e.stopPropagation();
    stopAutoScroll();
    setCurrentIndex((prevIndex) =>
      prevIndex === 0 ? images.length - 1 : prevIndex - 1
    );
    startAutoScroll();
  };

  const goToNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    stopAutoScroll();
    setCurrentIndex((prevIndex) =>
      prevIndex === images.length - 1 ? 0 : prevIndex + 1
    );
    startAutoScroll();
  };

  const goToIndex = (index: number) => {
    stopAutoScroll();
    setCurrentIndex(index);
    startAutoScroll();
  };

  if (images.length === 0) {
    return (
      <div className="menu-item-no-image">
        <span>No Image</span>
      </div>
    );
  }

  return (
    <div
      className="menu-item-carousel"
      onMouseEnter={stopAutoScroll}
      onMouseLeave={startAutoScroll}
    >
      <div
        className="menu-carousel-images-container"
        style={{ transform: `translateX(-${currentIndex * 100}%)` }}
      >
        {images.map((imgSrc, index) => (
          <img
            key={index}
            src={imgSrc}
            alt={`${itemName} - Image ${index + 1}`}
            className="menu-carousel-image"
          />
        ))}
      </div>

      {images.length > 1 && (
        <>
          <button
            className="menu-carousel-nav menu-carousel-prev"
            onClick={goToPrevious}
            aria-label="Previous image"
          >
            ‹
          </button>
          <button
            className="menu-carousel-nav menu-carousel-next"
            onClick={goToNext}
            aria-label="Next image"
          >
            ›
          </button>

          <div className="menu-carousel-indicators">
            {images.map((_, index) => (
              <span
                key={index}
                className={`menu-carousel-dot ${
                  index === currentIndex ? "active" : ""
                }`}
                onClick={() => goToIndex(index)}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default function MenuManager() {
  const [menuItems, setMenuItems] = useState<StoredMenuItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);

  // Initialize with default value, then set from localStorage after hydration
  const [viewMode, setViewMode] = useState<"grid" | "list">("list");
  const [isHydrated, setIsHydrated] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth <= 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const [stats, setStats] = useState({
    totalItems: 0,
    enabledItems: 0,
    disabledItems: 0,
    averagePrice: 0,
  });
  // Modal and editing state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<StoredMenuItem | null>(null);

  // Delete confirmation state
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<StoredMenuItem | null>(null);

  // Handle hydration and localStorage access
  useEffect(() => {
    setIsHydrated(true);
    // Only access localStorage after hydration is complete
    const storedMode = localStorage.getItem("menuViewMode");
    if (storedMode === "grid" || storedMode === "list") {
      setViewMode(storedMode);
    }
  }, []);

  useEffect(() => {
    loadMenuItems();
  }, []);

  const loadMenuItems = () => {
    const items = getMenuItems();
    setMenuItems(items);
    const menuStats = getMenuStats();
    setStats({
      totalItems: menuStats.totalItems,
      enabledItems: menuStats.enabledItems,
      disabledItems: menuStats.disabledItems,
      averagePrice: menuStats.averagePrice,
    });
  };

  const filteredItems = useMemo(() => {
    let items = [...menuItems];

    if (searchQuery.trim()) {
      items = searchMenuItems(searchQuery);
    }

    if (selectedCategory !== null) {
      items = items.filter((item) => item.categoryId === selectedCategory);
    }

    return items;
  }, [menuItems, searchQuery, selectedCategory]);

  const handleDelete = (id: string) => {
    const item = menuItems.find((item) => item.id === id);
    if (item) {
      setItemToDelete(item);
      setDeleteModalOpen(true);
    }
  };

  const confirmDelete = () => {
    if (itemToDelete) {
      deleteMenuItem(itemToDelete.id);
      loadMenuItems();
      setDeleteModalOpen(false);
      setItemToDelete(null);
    }
  };

  const cancelDelete = () => {
    setDeleteModalOpen(false);
    setItemToDelete(null);
  };

  const handleToggleStatus = (id: string) => {
    toggleItemEnabled(id);
    loadMenuItems();
  };

  const handleEdit = (id: string) => {
    const item = menuItems.find((item) => item.id === id);
    if (item) {
      setEditingItem(item);
      setModalOpen(true);
    }
  };

  const handleCreateNew = () => {
    setEditingItem(null);
    setModalOpen(true);
  };

  const handleModalClose = (value: boolean) => {
    setModalOpen(value);
    setEditingItem(null);
    // Reload items to reflect any changes
    loadMenuItems();
  };

  const handleViewChange = (mode: "grid" | "list") => {
    setViewMode(mode);
    // Only persist to localStorage if hydration is complete
    if (isHydrated) {
      localStorage.setItem("menuViewMode", mode);
    }
  };

  const getCategoryName = (categoryId: number) => {
    const category = defaultCategories.find((cat) => cat.id === categoryId);
    return category?.name || "Unknown";
  };

  // Helper function to get images array (handles backward compatibility)
  const getItemImages = (item: StoredMenuItem): string[] => {
    // If item has new images array, use it
    if (item.images && item.images.length > 0) {
      return item.images;
    }
    // Otherwise, fall back to single imageUrl if it exists
    if (item.imageUrl) {
      return [item.imageUrl];
    }
    // No images available
    return [];
  };

  return (
    <div className="page-wrapper">
      <NavBar />
      <div className="content-wrapper">
        <div className="menu-manager-container">
          {/* Header with stats */}
          <div className="menu-manager-header">
            <h1 className="menu-manager-title">Menu Manager</h1>
            <div className="menu-manager-stats">
              <div className="menu-stat-card">
                <div className="menu-stat-number">{stats.totalItems}</div>
                <div className="menu-stat-label">Total Items</div>
              </div>
              <div className="menu-stat-card">
                <div className="menu-stat-number">{stats.enabledItems}</div>
                <div className="menu-stat-label">Active</div>
              </div>
              <div className="menu-stat-card">
                <div className="menu-stat-number">
                  ${stats.averagePrice.toFixed(2)}
                </div>
                <div className="menu-stat-label">Avg Price</div>
              </div>
            </div>
            {/* Updated button */}
            <button className="menu-create-btn" onClick={handleCreateNew}>
              Create New Menu Item
            </button>
          </div>

          {/* Controls bar */}
          <div className="menu-controls">
            <input
              type="text"
              className="menu-search-bar"
              placeholder="Search menu items..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />

            <select
              className="menu-filter-select"
              value={selectedCategory || ""}
              onChange={(e) =>
                setSelectedCategory(
                  e.target.value ? Number(e.target.value) : null
                )
              }
            >
              <option value="">All Categories</option>
              {defaultCategories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>

            <div
              className="menu-view-toggle"
              style={{ display: isMobile ? "none" : "flex" }}
            >
              <button
                className={`menu-view-btn ${
                  viewMode === "grid" ? "active" : ""
                }`}
                onClick={() => handleViewChange("grid")}
              >
                Grid
              </button>
              <button
                className={`menu-view-btn ${
                  viewMode === "list" ? "active" : ""
                }`}
                onClick={() => handleViewChange("list")}
              >
                List
              </button>
            </div>
          </div>

          {/* Items display */}
          {filteredItems.length === 0 ? (
            <div className="menu-empty-state">
              <div className="menu-empty-icon">📋</div>
              <div className="menu-empty-text">
                {searchQuery || selectedCategory !== null
                  ? "No items found matching your criteria"
                  : "No menu items yet"}
              </div>
            </div>
          ) : (
            <div
              className={
                viewMode === "grid" ? "menu-items-grid" : "menu-items-list"
              }
            >
              {filteredItems.map((item) => (
                <div key={item.id} className="menu-item-card">
                  <ImageCarousel
                    images={getItemImages(item)}
                    itemName={item.name}
                  />

                  <div className="menu-item-content">
                    <div className="menu-item-header">
                      <h3 className="menu-item-name">{item.name}</h3>
                      <span className="menu-item-price">
                        ${item.basePrice.toFixed(2)}
                      </span>
                    </div>

                    <p className="menu-item-description">
                      {item.description || "No description"}
                    </p>

                    <div className="menu-item-tags">
                      <span className="menu-tag">
                        {getCategoryName(item.categoryId)}
                      </span>
                      {item.tags?.map((tag, index) => (
                        <span key={index} className="menu-tag">
                          {tag}
                        </span>
                      ))}
                    </div>

                    <div className="menu-item-actions">
                      <button
                        className="menu-action-btn menu-btn-edit"
                        onClick={() => handleEdit(item.id)}
                      >
                        Edit
                      </button>
                      <button
                        className={`menu-action-btn menu-btn-toggle ${
                          !item.enabled ? "disabled" : ""
                        }`}
                        onClick={() => handleToggleStatus(item.id)}
                      >
                        {item.enabled ? "Disable" : "Enable"}
                      </button>
                      <button
                        className="menu-action-btn menu-btn-delete"
                        onClick={() => handleDelete(item.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* MenuCreate Modal */}
      {modalOpen && (
        <MenuCreate removeBg={handleModalClose} editingItem={editingItem} />
      )}

      {/* Delete Confirmation Modal */}
      {deleteModalOpen && (
        <div className="delete-modal-overlay" onClick={cancelDelete}>
          <div
            className="delete-modal-content"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="delete-modal-header">
              <h3 className="delete-modal-title">Delete Menu Item</h3>
              <button
                onClick={cancelDelete}
                className="delete-modal-close"
                type="button"
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <div className="delete-modal-body">
              <div className="delete-modal-icon">⚠️</div>
              <p className="delete-modal-text">
                Are you sure you want to delete{" "}
                <strong>"{itemToDelete?.name}"</strong>?
              </p>
              <p className="delete-modal-subtext">
                This action cannot be undone.
              </p>
            </div>

            <div className="delete-modal-actions">
              <button
                onClick={cancelDelete}
                className="delete-modal-btn delete-modal-cancel"
                type="button"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="delete-modal-btn delete-modal-confirm"
                type="button"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
