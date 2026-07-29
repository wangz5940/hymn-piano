import { create } from "zustand";
import {
  practiceStorage,
  progressStorage,
  serviceSetStorage,
} from "@/features/progress/storage";
import type {
  HymnPracticeRecord,
  LearningProgress,
  ServiceSet,
  ServiceSetItem,
} from "@/features/progress/types";

interface AppState {
  progress: LearningProgress;
  records: HymnPracticeRecord[];
  service_set: ServiceSet;
  storage_available: boolean;
  toggleTask: (taskId: string) => void;
  advancePracticeDay: () => void;
  toggleFavorite: (hymnKey: string) => void;
  rememberHymn: (hymnKey: string) => void;
  addPracticeRecord: (record: HymnPracticeRecord) => void;
  clearPracticeRecords: () => void;
  addToServiceSet: (hymnKey: string) => void;
  updateServiceSetMeta: (values: {
    title?: string;
    scheduled_for?: string;
  }) => void;
  updateServiceItem: (
    itemId: string,
    values: Partial<
      Pick<
        ServiceSetItem,
        "practice_key" | "bpm" | "count_in" | "transition_note"
      >
    >,
  ) => void;
  moveServiceItem: (itemId: string, direction: -1 | 1) => void;
  removeServiceItem: (itemId: string) => void;
  replaceServiceSet: (serviceSet: ServiceSet) => void;
}

const createId = (prefix: string): string =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

function persistProgress(progress: LearningProgress): boolean {
  return progressStorage.save(progress);
}

function persistRecords(records: HymnPracticeRecord[]): boolean {
  return practiceStorage.save(records);
}

function persistServiceSet(serviceSet: ServiceSet): boolean {
  return serviceSetStorage.save(serviceSet);
}

export const useAppStore = create<AppState>((set) => ({
  progress: progressStorage.load(),
  records: practiceStorage.load(),
  service_set: serviceSetStorage.load(),
  storage_available: true,

  toggleTask: (taskId) =>
    set((state) => {
      const exists = state.progress.completed_tasks.some(
        (completion) => completion.task_id === taskId,
      );
      const completed_tasks = exists
        ? state.progress.completed_tasks.filter(
            (completion) => completion.task_id !== taskId,
          )
        : [
            ...state.progress.completed_tasks,
            { task_id: taskId, completed_at: new Date().toISOString() },
          ];
      const progress = { ...state.progress, completed_tasks };
      return {
        progress,
        storage_available:
          persistProgress(progress) && state.storage_available,
      };
    }),

  advancePracticeDay: () =>
    set((state) => {
      const currentDay = state.progress.current_day;
      const progress: LearningProgress =
        currentDay < 3
          ? {
              ...state.progress,
              current_day: (currentDay + 1) as 2 | 3,
            }
          : {
              ...state.progress,
              current_week: Math.min(48, state.progress.current_week + 1),
              current_day: 1,
            };
      return {
        progress,
        storage_available:
          persistProgress(progress) && state.storage_available,
      };
    }),

  toggleFavorite: (hymnKey) =>
    set((state) => {
      const favorite_hymn_keys = state.progress.favorite_hymn_keys.includes(
        hymnKey,
      )
        ? state.progress.favorite_hymn_keys.filter((key) => key !== hymnKey)
        : [...state.progress.favorite_hymn_keys, hymnKey];
      const progress = { ...state.progress, favorite_hymn_keys };
      return {
        progress,
        storage_available:
          persistProgress(progress) && state.storage_available,
      };
    }),

  rememberHymn: (hymnKey) =>
    set((state) => {
      const recent_hymn_keys = [
        hymnKey,
        ...state.progress.recent_hymn_keys.filter((key) => key !== hymnKey),
      ].slice(0, 12);
      const progress = { ...state.progress, recent_hymn_keys };
      return {
        progress,
        storage_available:
          persistProgress(progress) && state.storage_available,
      };
    }),

  addPracticeRecord: (record) =>
    set((state) => {
      const records = [record, ...state.records].slice(0, 2000);
      return {
        records,
        storage_available:
          persistRecords(records) && state.storage_available,
      };
    }),

  clearPracticeRecords: () =>
    set((state) => ({
      records: [],
      storage_available:
        persistRecords([]) && state.storage_available,
    })),

  addToServiceSet: (hymnKey) =>
    set((state) => {
      if (
        state.service_set.items.some((item) => item.hymn_key === hymnKey)
      ) {
        return state;
      }
      const item: ServiceSetItem = {
        id: createId("service-item"),
        hymn_key: hymnKey,
        position: state.service_set.items.length,
        practice_key: "C",
        bpm: 72,
        count_in: "四拍预备",
        transition_note: "",
      };
      const service_set = {
        ...state.service_set,
        items: [...state.service_set.items, item],
        updated_at: new Date().toISOString(),
      };
      return {
        service_set,
        storage_available:
          persistServiceSet(service_set) && state.storage_available,
      };
    }),

  updateServiceSetMeta: (values) =>
    set((state) => {
      const service_set = {
        ...state.service_set,
        ...values,
        updated_at: new Date().toISOString(),
      };
      return {
        service_set,
        storage_available:
          persistServiceSet(service_set) && state.storage_available,
      };
    }),

  updateServiceItem: (itemId, values) =>
    set((state) => {
      const service_set = {
        ...state.service_set,
        items: state.service_set.items.map((item) =>
          item.id === itemId ? { ...item, ...values } : item,
        ),
        updated_at: new Date().toISOString(),
      };
      return {
        service_set,
        storage_available:
          persistServiceSet(service_set) && state.storage_available,
      };
    }),

  moveServiceItem: (itemId, direction) =>
    set((state) => {
      const items = [...state.service_set.items].sort(
        (left, right) => left.position - right.position,
      );
      const index = items.findIndex((item) => item.id === itemId);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= items.length) return state;
      [items[index], items[target]] = [items[target], items[index]];
      const service_set = {
        ...state.service_set,
        items: items.map((item, position) => ({ ...item, position })),
        updated_at: new Date().toISOString(),
      };
      return {
        service_set,
        storage_available:
          persistServiceSet(service_set) && state.storage_available,
      };
    }),

  removeServiceItem: (itemId) =>
    set((state) => {
      const items = state.service_set.items
        .filter((item) => item.id !== itemId)
        .map((item, position) => ({ ...item, position }));
      const service_set = {
        ...state.service_set,
        items,
        updated_at: new Date().toISOString(),
      };
      return {
        service_set,
        storage_available:
          persistServiceSet(service_set) && state.storage_available,
      };
    }),

  replaceServiceSet: (service_set) =>
    set((state) => ({
      service_set,
      storage_available:
        persistServiceSet(service_set) && state.storage_available,
    })),
}));
