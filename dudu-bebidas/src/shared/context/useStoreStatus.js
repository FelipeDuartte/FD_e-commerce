import { useContext } from "react";
import { getStoreStatus } from "../utils/storeStatus";
import { StoreHoursContext, StoreStatusContext } from "./storeStatusContexts";

export function useStoreStatus() {
  const ctx = useContext(StoreStatusContext);
  return ctx ?? getStoreStatus();
}

export function useStoreHoursData() {
  return useContext(StoreHoursContext);
}
