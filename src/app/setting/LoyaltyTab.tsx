"use client";

import { useState, useEffect } from "react";

// Types and Interfaces
interface Reward {
  id: string;
  name: string;
  icon: string;
  category: "Beverage" | "Food" | "Dessert" | "Other";
  active: boolean;
  createdAt: string;
}

interface LoyaltyConfig {
  buy: number;
  free: number;
  stamps: number;
  rewardId: string;
}

interface RewardCatalog {
  rewards: Reward[];
  lastUpdated: string;
}

// RewardService Class - handles all reward operations
class RewardService {
  private readonly REWARDS_KEY = "reward_catalog";
  private readonly DEFAULT_REWARDS: Reward[] = [
    {
      id: "reward_1",
      name: "Free Drink",
      icon: "🥤",
      category: "Beverage",
      active: true,
      createdAt: new Date().toISOString(),
    },
    {
      id: "reward_2",
      name: "Free Coffee",
      icon: "☕",
      category: "Beverage",
      active: true,
      createdAt: new Date().toISOString(),
    },
    {
      id: "reward_3",
      name: "Free Dessert",
      icon: "🍰",
      category: "Dessert",
      active: true,
      createdAt: new Date().toISOString(),
    },
    {
      id: "reward_4",
      name: "Free Side",
      icon: "🍟",
      category: "Food",
      active: true,
      createdAt: new Date().toISOString(),
    },
    {
      id: "reward_5",
      name: "Free Appetizer",
      icon: "🥗",
      category: "Food",
      active: true,
      createdAt: new Date().toISOString(),
    },
  ];

  // Initialize default rewards if not exists
  constructor() {
    if (typeof window !== "undefined") {
      this.initializeRewards();
    }
  }

  private initializeRewards(): void {
    const existing = localStorage.getItem(this.REWARDS_KEY);
    if (!existing) {
      const catalog: RewardCatalog = {
        rewards: this.DEFAULT_REWARDS,
        lastUpdated: new Date().toISOString(),
      };
      localStorage.setItem(this.REWARDS_KEY, JSON.stringify(catalog));
    }
  }

  // Get all rewards
  async getRewards(): Promise<Reward[]> {
    if (typeof window === "undefined") return this.DEFAULT_REWARDS;

    const catalogStr = localStorage.getItem(this.REWARDS_KEY);
    if (!catalogStr) {
      this.initializeRewards();
      return this.DEFAULT_REWARDS;
    }
    const catalog: RewardCatalog = JSON.parse(catalogStr);
    return catalog.rewards;
  }

  // Add new reward
  async addReward(reward: Omit<Reward, "id" | "createdAt">): Promise<Reward> {
    if (typeof window === "undefined") {
      throw new Error("localStorage not available");
    }

    const rewards = await this.getRewards();
    const newReward: Reward = {
      ...reward,
      id: `reward_${Date.now()}`,
      createdAt: new Date().toISOString(),
    };

    const catalog: RewardCatalog = {
      rewards: [...rewards, newReward],
      lastUpdated: new Date().toISOString(),
    };

    localStorage.setItem(this.REWARDS_KEY, JSON.stringify(catalog));
    return newReward;
  }

  // Update reward
  async updateReward(
    id: string,
    updates: Partial<Reward>
  ): Promise<Reward | null> {
    if (typeof window === "undefined") {
      throw new Error("localStorage not available");
    }

    const rewards = await this.getRewards();
    const index = rewards.findIndex((r) => r.id === id);

    if (index === -1) return null;

    rewards[index] = { ...rewards[index], ...updates };

    const catalog: RewardCatalog = {
      rewards,
      lastUpdated: new Date().toISOString(),
    };

    localStorage.setItem(this.REWARDS_KEY, JSON.stringify(catalog));
    return rewards[index];
  }

  // Delete reward
  async deleteReward(id: string): Promise<boolean> {
    if (typeof window === "undefined") {
      throw new Error("localStorage not available");
    }

    const rewards = await this.getRewards();
    const filtered = rewards.filter((r) => r.id !== id);

    if (filtered.length === rewards.length) return false;

    const catalog: RewardCatalog = {
      rewards: filtered,
      lastUpdated: new Date().toISOString(),
    };

    localStorage.setItem(this.REWARDS_KEY, JSON.stringify(catalog));
    return true;
  }

  // Toggle reward active status
  async toggleRewardStatus(id: string): Promise<Reward | null> {
    const rewards = await this.getRewards();
    const reward = rewards.find((r) => r.id === id);

    if (!reward) return null;

    return this.updateReward(id, { active: !reward.active });
  }
}

export default function LoyaltyTab() {
  // Core loyalty state
  const [selectedFood, setSelectedFood] = useState<string>("Sushi");
  const [buyAmount, setBuyAmount] = useState<number>(5);
  const [freeAmount, setFreeAmount] = useState<number>(1);
  const [stampsCollected, setStampsCollected] = useState<number>(0);

  // Reward management state
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [selectedRewardId, setSelectedRewardId] = useState<string>("");
  const [showAddReward, setShowAddReward] = useState<boolean>(false);
  const [newRewardName, setNewRewardName] = useState<string>("");
  const [newRewardIcon, setNewRewardIcon] = useState<string>("🎁");
  const [newRewardCategory, setNewRewardCategory] = useState<"Beverage" | "Food" | "Dessert" | "Other">("Other");
  const [rewardService, setRewardService] = useState<RewardService | null>(
    null
  );
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Icon options for new rewards
  const iconOptions = [
    "🎁",
    "🥤",
    "☕",
    "🍰",
    "🍟",
    "🥗",
    "🍔",
    "🍕",
    "🍺",
    "🍷",
    "🧁",
    "🍪",
    "🍩",
    "🥐",
    "🌮",
    "🥙",
  ];

  // Initialize service on client-side only
  useEffect(() => {
    setRewardService(new RewardService());
    setIsLoading(false);
  }, []);

  // Load rewards when service is available
  useEffect(() => {
    if (rewardService) {
      loadRewards();
    }
  }, [rewardService]);

  // Load rewards from service
  const loadRewards = async () => {
    if (!rewardService) return;

    const loadedRewards = await rewardService.getRewards();
    setRewards(loadedRewards);
  };

  // Load loyalty config for selected food
  const loadFoodConfig = (food: string) => {
    if (typeof window === "undefined") return;

    const storedConfig = localStorage.getItem(`loyalty_${food}`);
    if (storedConfig) {
      const config: LoyaltyConfig = JSON.parse(storedConfig);
      setBuyAmount(config.buy);
      setFreeAmount(config.free);
      setStampsCollected(config.stamps);
      setSelectedRewardId(config.rewardId || rewards[0]?.id || "");
    } else {
      // Default values for new food
      const defaultRewardId = rewards[0]?.id || "";
      setBuyAmount(5);
      setFreeAmount(1);
      setStampsCollected(0);
      setSelectedRewardId(defaultRewardId);
      saveFoodConfig(food, 5, 1, 0, defaultRewardId);
    }
  };

  // Save loyalty config for specific food
  const saveFoodConfig = (
    food: string,
    buy: number,
    free: number,
    stamps: number,
    rewardId: string
  ) => {
    if (typeof window === "undefined") return;

    const config: LoyaltyConfig = { buy, free, stamps, rewardId };
    localStorage.setItem(`loyalty_${food}`, JSON.stringify(config));
  };

  // Load config when food changes or rewards load
  useEffect(() => {
    if (rewards.length > 0 && typeof window !== "undefined") {
      loadFoodConfig(selectedFood);
    }
  }, [selectedFood, rewards]);

  // Handle food selection
  const handleSelectFood = (food: string): void => {
    setSelectedFood(food);
  };

  // Handle buy slider change
  const handleBuySlider = (value: number): void => {
    setBuyAmount(value);
    saveFoodConfig(
      selectedFood,
      value,
      freeAmount,
      stampsCollected,
      selectedRewardId
    );
  };

  // Handle free slider change
  const handleFreeSlider = (value: number): void => {
    setFreeAmount(value);
    saveFoodConfig(
      selectedFood,
      buyAmount,
      value,
      stampsCollected,
      selectedRewardId
    );
  };

  // Handle reward selection
  const handleRewardSelection = (rewardId: string): void => {
    setSelectedRewardId(rewardId);
    saveFoodConfig(
      selectedFood,
      buyAmount,
      freeAmount,
      stampsCollected,
      rewardId
    );
  };

  // Add new reward
  const handleAddReward = async () => {
    if (!newRewardName.trim() || !rewardService) return;

    await rewardService.addReward({
      name: newRewardName,
      icon: newRewardIcon,
      category: newRewardCategory,
      active: true,
    });

    await loadRewards();
    setNewRewardName("");
    setNewRewardIcon("🎁");
    setNewRewardCategory("Other");
    setShowAddReward(false);
  };

  // Delete reward
  const handleDeleteReward = async (rewardId: string) => {
    if (!rewardService) return;

    // Don't delete if it's the selected reward
    if (rewardId === selectedRewardId) {
      alert(
        "Cannot delete the currently selected reward. Please select a different reward first."
      );
      return;
    }

    const confirmed = confirm("Are you sure you want to delete this reward?");
    if (confirmed) {
      await rewardService.deleteReward(rewardId);
      await loadRewards();
    }
  };

  // Toggle reward active status
  const handleToggleReward = async (rewardId: string) => {
    if (!rewardService) return;

    await rewardService.toggleRewardStatus(rewardId);
    await loadRewards();
  };

  // Test functions for stamps
  const addStamp = () => {
    const newStamps = stampsCollected + 1;
    if (newStamps > buyAmount) {
      setStampsCollected(0);
      saveFoodConfig(selectedFood, buyAmount, freeAmount, 0, selectedRewardId);
    } else {
      setStampsCollected(newStamps);
      saveFoodConfig(
        selectedFood,
        buyAmount,
        freeAmount,
        newStamps,
        selectedRewardId
      );
    }
  };

  const removeStamp = () => {
    const newStamps = Math.max(0, stampsCollected - 1);
    setStampsCollected(newStamps);
    saveFoodConfig(
      selectedFood,
      buyAmount,
      freeAmount,
      newStamps,
      selectedRewardId
    );
  };

  const resetStamps = () => {
    setStampsCollected(0);
    saveFoodConfig(selectedFood, buyAmount, freeAmount, 0, selectedRewardId);
  };

  // Calculate progress percentages for sliders
  const buyProgressPercentage = ((buyAmount - 1) / (10 - 1)) * 100;
  const freeProgressPercentage = ((freeAmount - 1) / (10 - 1)) * 100;

  // Get current selected reward
  const getCurrentReward = (): Reward | undefined => {
    return rewards.find((r) => r.id === selectedRewardId);
  };

  // Get stamp collection message
  const getStampMessage = () => {
    const currentReward = getCurrentReward();
    const rewardName = currentReward
      ? currentReward.name.toLowerCase()
      : "reward";

    if (stampsCollected === 0) {
      return `Start collecting - your first stamp awaits!`;
    } else if (stampsCollected === buyAmount) {
      return `Congratulations! Claim your ${freeAmount} ${rewardName}${
        freeAmount > 1 ? "s" : ""
      }!`;
    } else {
      const remaining = buyAmount - stampsCollected;
      return `${remaining} more stamp${
        remaining > 1 ? "s" : ""
      } until your ${rewardName}!`;
    }
  };

  // Show loading state
  if (isLoading) {
    return (
      <div style={{ textAlign: "center", padding: "40px" }}>
        Loading loyalty settings...
      </div>
    );
  }

  return (
    <>
      {/* Food Category Selector */}
      <div className="food-selector-container">
        <div className="food-icons">
          <div
            className={`food-item ${
              selectedFood === "Sushi" ? "selected" : ""
            }`}
            onClick={() => handleSelectFood("Sushi")}
          >
            <div className="food-icon-wrapper">🍣</div>
          </div>
          <div
            className={`food-item ${
              selectedFood === "Pizza" ? "selected" : ""
            }`}
            onClick={() => handleSelectFood("Pizza")}
          >
            <div className="food-icon-wrapper">🍕</div>
          </div>
          <div
            className={`food-item ${
              selectedFood === "Cheese" ? "selected" : ""
            }`}
            onClick={() => handleSelectFood("Cheese")}
          >
            <div className="food-icon-wrapper">🧀</div>
          </div>
          <div
            className={`food-item ${
              selectedFood === "Burger" ? "selected" : ""
            }`}
            onClick={() => handleSelectFood("Burger")}
          >
            <div className="food-icon-wrapper">🍔</div>
          </div>
        </div>
      </div>

      {/* Reward Selection Section */}
      <div className="reward-selector-container">
        <h3 className="reward-selector-title">
          Select Reward for {selectedFood}
        </h3>

        <div className="reward-icons">
          {rewards
            .filter((r) => r.active)
            .map((reward) => (
              <div
                key={reward.id}
                className={`reward-item ${
                  selectedRewardId === reward.id ? "selected" : ""
                }`}
                onClick={() => handleRewardSelection(reward.id)}
              >
                <div className="reward-icon-wrapper">{reward.icon}</div>
                <div className="reward-name">{reward.name}</div>
              </div>
            ))}
        </div>

        {/* Manage Rewards Toggle Button */}
        <div className="reward-manage-button-container">
          <button
            className="reward-manage-btn"
            onClick={() => setShowAddReward(!showAddReward)}
          >
            {showAddReward ? "Cancel" : "Manage Rewards"}
          </button>
        </div>

        {/* Add/Manage Rewards Section */}
        {showAddReward && (
          <div className="reward-management-section">
            <h4 className="reward-section-title">Add New Reward</h4>

            <div className="reward-add-form">
              <input
                type="text"
                placeholder="Reward name"
                value={newRewardName}
                onChange={(e) => setNewRewardName(e.target.value)}
                className="reward-input"
              />

              <select
                value={newRewardIcon}
                onChange={(e) => setNewRewardIcon(e.target.value)}
                className="reward-select"
              >
                {iconOptions.map((icon) => (
                  <option key={icon} value={icon}>
                    {icon}
                  </option>
                ))}
              </select>

              <select
                value={newRewardCategory}
                onChange={(e) =>
                  setNewRewardCategory(
                    e.target.value as typeof newRewardCategory
                  )
                }
                className="reward-select"
              >
                <option value="Beverage">Beverage</option>
                <option value="Food">Food</option>
                <option value="Dessert">Dessert</option>
                <option value="Other">Other</option>
              </select>

              <button
                className="reward-add-btn"
                onClick={handleAddReward}
                disabled={!newRewardName.trim()}
              >
                Add
              </button>
            </div>

            {/* List of all rewards */}
            <div className="reward-list-section">
              <h4 className="reward-section-title">All Rewards</h4>
              <div className="reward-list">
                {rewards.map((reward) => (
                  <div key={reward.id} className="reward-list-item">
                    <div className="reward-info">
                      <span className="reward-list-icon">{reward.icon}</span>
                      <span className="reward-list-name">{reward.name}</span>
                      <span className="reward-list-category">
                        {reward.category}
                      </span>
                    </div>
                    <div className="reward-actions">
                      <button
                        className={`reward-status-btn ${
                          reward.active ? "active" : "inactive"
                        }`}
                        onClick={() => handleToggleReward(reward.id)}
                      >
                        {reward.active ? "Active" : "Inactive"}
                      </button>
                      <button
                        className="reward-delete-btn"
                        onClick={() => handleDeleteReward(reward.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Slider Section */}
      <div className="slider-section">
        <h3>
          Buy {buyAmount} get {freeAmount} {getCurrentReward()?.name || "free"}!
        </h3>

        {/* Buy Amount Slider */}
        <div style={{ marginBottom: "25px" }}>
          <p
            style={{
              fontSize: "14px",
              color: "var(--hum-text-secondary)",
              marginBottom: "10px",
            }}
          >
            How many to buy?
          </p>
          <div className="slider-container">
            <div
              className="slider-track"
              style={{
                background: `linear-gradient(to right, var(--hum-primary) 0%, var(--hum-primary) ${buyProgressPercentage}%, var(--slider-track-bg) ${buyProgressPercentage}%, var(--slider-track-bg) 100%)`,
              }}
            >
              <input
                type="range"
                max={10}
                min={1}
                value={buyAmount}
                onChange={(e) => handleBuySlider(Number(e.target.value))}
                className="loyalty-slider"
              />
            </div>
            <div className="slider-labels">
              <span>1</span>
              <span className="current-value">{buyAmount}</span>
              <span>10</span>
            </div>
          </div>
        </div>

        {/* Free Amount Slider */}
        <div>
          <p
            style={{
              fontSize: "14px",
              color: "var(--hum-text-secondary)",
              marginBottom: "10px",
            }}
          >
            How many free?
          </p>
          <div className="slider-container">
            <div
              className="slider-track"
              style={{
                background: `linear-gradient(to right, var(--hum-primary) 0%, var(--hum-primary) ${freeProgressPercentage}%, var(--slider-track-bg) ${freeProgressPercentage}%, var(--slider-track-bg) 100%)`,
              }}
            >
              <input
                type="range"
                max={10}
                min={1}
                value={freeAmount}
                onChange={(e) => handleFreeSlider(Number(e.target.value))}
                className="loyalty-slider"
              />
            </div>
            <div className="slider-labels">
              <span>1</span>
              <span className="current-value">{freeAmount}</span>
              <span>10</span>
            </div>
          </div>
        </div>
      </div>

      {/* Loyalty Card Preview */}
      <div className="loyalty-card-preview">
        <div className="loyalty-card">
          <h3>Place Name</h3>
          <p>Loyalty Card - {selectedFood}</p>
          <div className="loyalty-stamps">
            {Array.from({ length: buyAmount }).map((_, index) => (
              <div
                key={index}
                className={`stamp ${index < stampsCollected ? "filled" : ""}`}
              >
                {index + 1}
              </div>
            ))}
            <div className="stamp free">{getCurrentReward()?.icon || "🎁"}</div>
          </div>
          <p className="loyalty-text" style={{ marginTop: "10px" }}>
            {getStampMessage()}
          </p>
          <p className="loyalty-text">
            BUY {buyAmount} GET {freeAmount}{" "}
            <span>{getCurrentReward()?.name || "FREE"}</span>
          </p>

          {/* Test buttons - remove in production */}
          <div className="test-controls">
            <button onClick={addStamp} className="test-btn add-btn">
              + Add
            </button>
            <button onClick={removeStamp} className="test-btn remove-btn">
              - Remove
            </button>
            <button onClick={resetStamps} className="test-btn reset-btn">
              ↺ Reset
            </button>
          </div>
        </div>
      </div>

      {/* Benefits Section */}
      <div className="benefits-section">
        <div className="benefit-card">
          <h4>Your Benefits</h4>
          <ul>
            <li>✓ 10% off all orders</li>
            <li>✓ Free drink every 5 visits</li>
          </ul>
        </div>
        <div className="benefit-card">
          <h4>Next Tier</h4>
          <p>Platinum: 15% off + free dessert</p>
        </div>
      </div>
    </>
  );
}
