import { useAppStore } from "@/store/useAppStore";
import { createDefaultServiceSet } from "./storage";

describe("服侍曲单状态", () => {
  beforeEach(() => {
    useAppStore.setState({ service_set: createDefaultServiceSet() });
  });

  it("新增时去重并维持顺序", () => {
    const store = useAppStore.getState();
    store.addToServiceSet("1");
    useAppStore.getState().addToServiceSet("2");
    useAppStore.getState().addToServiceSet("1");
    expect(useAppStore.getState().service_set.items.map((item) => item.hymn_key)).toEqual([
      "1",
      "2",
    ]);
  });

  it("支持上移、下移与删除", () => {
    useAppStore.getState().addToServiceSet("1");
    useAppStore.getState().addToServiceSet("2");
    const second = useAppStore.getState().service_set.items[1];
    useAppStore.getState().moveServiceItem(second.id, -1);
    expect(useAppStore.getState().service_set.items[0].hymn_key).toBe("2");
    useAppStore.getState().removeServiceItem(second.id);
    expect(useAppStore.getState().service_set.items).toHaveLength(1);
  });
});
