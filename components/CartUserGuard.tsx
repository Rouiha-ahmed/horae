"use client";

import { useAuth } from "@clerk/nextjs";
import { useEffect } from "react";
import useStore, { type CartItem } from "@/store";

const CART_OWNER_KEY = "cart-store-owner";
const CART_SNAPSHOTS_KEY = "cart-store-snapshots";
const GUEST_OWNER = "guest";

type CartSnapshots = Record<string, CartItem[]>;

const normalizeCartItems = (items: CartItem[]) => {
  const merged = new Map<string, CartItem>();

  for (const item of items) {
    const productId = item.product?._id;
    if (!productId) {
      continue;
    }

    const existing = merged.get(productId);
    if (existing) {
      merged.set(productId, {
        ...existing,
        quantity: existing.quantity + Math.max(1, item.quantity || 0),
      });
      continue;
    }

    merged.set(productId, {
      product: item.product,
      quantity: Math.max(1, item.quantity || 0),
    });
  }

  return [...merged.values()];
};

const mergeCartItems = (baseItems: CartItem[], incomingItems: CartItem[]) =>
  normalizeCartItems([...baseItems, ...incomingItems]);

const areCartItemsEqual = (left: CartItem[], right: CartItem[]) => {
  const normalizedLeft = normalizeCartItems(left);
  const normalizedRight = normalizeCartItems(right);

  if (normalizedLeft.length !== normalizedRight.length) {
    return false;
  }

  return normalizedLeft.every((item, index) => {
    const other = normalizedRight[index];
    return (
      item.product._id === other?.product._id &&
      item.quantity === other.quantity
    );
  });
};

const readSnapshots = (): CartSnapshots => {
  const raw = window.localStorage.getItem(CART_SNAPSHOTS_KEY);
  if (!raw) {
    return {};
  }

  try {
    const parsed = JSON.parse(raw) as CartSnapshots;
    if (!parsed || typeof parsed !== "object") {
      return {};
    }

    return Object.fromEntries(
      Object.entries(parsed).map(([owner, items]) => [
        owner,
        Array.isArray(items) ? normalizeCartItems(items) : [],
      ])
    );
  } catch {
    return {};
  }
};

const writeSnapshots = (snapshots: CartSnapshots) => {
  window.localStorage.setItem(
    CART_SNAPSHOTS_KEY,
    JSON.stringify(snapshots)
  );
};

const CartUserGuard = () => {
  const { isLoaded, userId } = useAuth();
  const hasHydrated = useStore((state) => state.hasHydrated);
  const items = useStore((state) => state.items);
  const replaceCart = useStore((state) => state.replaceCart);

  useEffect(() => {
    if (!isLoaded || !hasHydrated) {
      return;
    }

    const previousOwner =
      window.localStorage.getItem(CART_OWNER_KEY) ?? GUEST_OWNER;
    const nextOwner = userId ?? GUEST_OWNER;
    const snapshots = readSnapshots();
    const currentItems = normalizeCartItems(items);

    snapshots[previousOwner] = currentItems;

    if (previousOwner === nextOwner) {
      writeSnapshots(snapshots);
      window.localStorage.setItem(CART_OWNER_KEY, nextOwner);
      return;
    }

    const nextItems =
      previousOwner === GUEST_OWNER && userId
        ? mergeCartItems(snapshots[userId] ?? [], currentItems)
        : normalizeCartItems(snapshots[nextOwner] ?? []);

    snapshots[nextOwner] = nextItems;
    writeSnapshots(snapshots);
    window.localStorage.setItem(CART_OWNER_KEY, nextOwner);

    if (!areCartItemsEqual(currentItems, nextItems)) {
      replaceCart(nextItems);
    }
  }, [hasHydrated, isLoaded, items, replaceCart, userId]);

  return null;
};

export default CartUserGuard;
