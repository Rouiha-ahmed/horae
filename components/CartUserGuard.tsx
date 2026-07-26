"use client";

import { useAuth } from "@clerk/nextjs";
import { useEffect } from "react";
import useStore from "@/store";

const CART_OWNER_KEY = "cart-store-owner";
const GUEST_OWNER = "guest";

const CartUserGuard = () => {
  const { isLoaded, userId } = useAuth();
  const resetCart = useStore((state) => state.resetCart);

  useEffect(() => {
    if (!isLoaded) {
      return;
    }

    const previousOwner =
      window.localStorage.getItem(CART_OWNER_KEY) ?? GUEST_OWNER;

    if (!userId) {
      if (!window.localStorage.getItem(CART_OWNER_KEY)) {
        window.localStorage.setItem(CART_OWNER_KEY, GUEST_OWNER);
      }
      return;
    }

    if (previousOwner === GUEST_OWNER || previousOwner === userId) {
      window.localStorage.setItem(CART_OWNER_KEY, userId);
      return;
    }

    if (previousOwner !== userId) {
      resetCart();
      window.localStorage.setItem(CART_OWNER_KEY, userId);
    }
  }, [isLoaded, userId, resetCart]);

  return null;
};

export default CartUserGuard;
