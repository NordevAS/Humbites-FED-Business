// RewardService.ts

// Reward item in catalog
export interface Reward {
  id: string; // unique id
  name: string; // reward name
  icon: string; // emoji/icon
  category: "Beverage" | "Food" | "Dessert" | "Other"; // category type
  active: boolean; // active/inactive
  createdAt: string; // timestamp
}

// Loyalty config for each food item
export interface LoyaltyConfig {
  buy: number; // how many to buy
  free: number; // how many free
  stamps: number; // current collected stamps
  rewardId: string; // id of associated reward
}

// Wrapper for storing rewards in localStorage
export interface RewardCatalog {
  rewards: Reward[];
  lastUpdated: string;
}

// Handles all reward CRUD and localStorage
class RewardService {
  private storageKey = "reward_catalog";

  // Initialize default rewards if none exist
  constructor() {
    if (typeof window !== "undefined") this.initializeRewards();
  }

  private initializeRewards(): void {
    if (!localStorage.getItem(this.storageKey)) {
      const defaultRewards: Reward[] = [
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
      const catalog: RewardCatalog = {
        rewards: defaultRewards,
        lastUpdated: new Date().toISOString(),
      };
      localStorage.setItem(this.storageKey, JSON.stringify(catalog));
    }
  }

  // Get all rewards
  getRewards(): Reward[] {
    const data = localStorage.getItem(this.storageKey);
    if (!data) return [];
    try {
      const catalog: RewardCatalog = JSON.parse(data);
      return catalog.rewards || [];
    } catch {
      console.warn("RewardService: invalid data, resetting");
      return [];
    }
  }

  // Save rewards
  private saveRewards(rewards: Reward[]): void {
    const catalog: RewardCatalog = {
      rewards,
      lastUpdated: new Date().toISOString(),
    };
    localStorage.setItem(this.storageKey, JSON.stringify(catalog));
  }

  // Add new reward
  addReward(reward: Omit<Reward, "id" | "createdAt">): Reward {
    const rewards = this.getRewards();
    const newReward: Reward = {
      ...reward,
      id: `reward_${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    rewards.push(newReward);
    this.saveRewards(rewards);
    return newReward;
  }

  // Update reward by id
  updateReward(id: string, updates: Partial<Reward>): Reward | null {
    const rewards = this.getRewards();
    const index = rewards.findIndex((r) => r.id === id);
    if (index === -1) return null;
    rewards[index] = { ...rewards[index], ...updates };
    this.saveRewards(rewards);
    return rewards[index];
  }

  // Delete reward by id
  deleteReward(id: string): boolean {
    const rewards = this.getRewards();
    const filtered = rewards.filter((r) => r.id !== id);
    if (filtered.length === rewards.length) return false;
    this.saveRewards(filtered);
    return true;
  }

  // Toggle active status of reward
  toggleRewardStatus(id: string): Reward | null {
    const rewards = this.getRewards();
    const reward = rewards.find((r) => r.id === id);
    if (!reward) return null;
    return this.updateReward(id, { active: !reward.active });
  }
}

export default RewardService;
