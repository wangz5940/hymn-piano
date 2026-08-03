import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";
import { useAppStore } from "@/store/useAppStore";
import {
  createDefaultProgress,
  createDefaultServiceSet,
  STORAGE_KEYS,
} from "@/features/progress/storage";
import {
  makeArrangement,
  makeScore,
} from "@/test/scoreFixtures";

const { useHymnAssetsMock } = vi.hoisted(() => ({
  useHymnAssetsMock: vi.fn(),
}));

vi.mock("@/hooks/useHymnAssets", () => ({
  useHymnAssets: useHymnAssetsMock,
}));

beforeEach(() => {
  window.location.hash = "#/";
  useHymnAssetsMock.mockImplementation(
    (hymn: { key: string; score_source?: "pptx" | "image"; fallback_reason?: string | null }) => {
      if (hymn.score_source === "image") {
        return {
          assets: {
            status: "image",
            reason: hymn.fallback_reason ?? "该曲目仅提供图片谱。",
          },
          retry: vi.fn(),
          useImageFallback: vi.fn(),
        };
      }
      return {
        assets: {
          status: "structured",
          score: makeScore({ hymn_key: hymn.key }),
          arrangement: makeArrangement({ hymn_key: hymn.key }),
        },
        retry: vi.fn(),
        useImageFallback: vi.fn(),
      };
    },
  );
  useAppStore.setState({
    progress: createDefaultProgress(),
    records: [],
    service_set: createDefaultServiceSet(),
    sidebar_collapsed: false,
    storage_available: true,
  });
});

describe("诗琴应用", () => {
  it("显示品牌、主导航和今日课程", () => {
    render(<App />);
    expect(screen.getByRole("link", { name: "诗琴首页" })).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "主导航" })).toBeInTheDocument();
    expect(screen.getByText("认识十根手指")).toBeInTheDocument();
  });

  it("可收起、展开侧边栏并保存状态", async () => {
    const user = userEvent.setup();
    render(<App />);
    const sidebar = screen.getByRole("complementary", {
      name: "主侧边栏",
    });
    const shell = sidebar.closest(".app-shell");

    await user.click(
      screen.getByRole("button", { name: "收起侧边栏" }),
    );
    expect(shell).toHaveClass("app-shell--sidebar-collapsed");
    expect(
      screen.getByRole("button", { name: "展开侧边栏" }),
    ).toHaveAttribute("aria-expanded", "false");
    expect(
      within(screen.getByRole("navigation", { name: "主导航" })).getByRole(
        "link",
        { name: "今日" },
      ),
    ).toBeInTheDocument();
    expect(
      localStorage.getItem(STORAGE_KEYS.sidebarCollapsed),
    ).toBe("true");

    await user.click(
      screen.getByRole("button", { name: "展开侧边栏" }),
    );
    expect(shell).not.toHaveClass("app-shell--sidebar-collapsed");
    expect(
      localStorage.getItem(STORAGE_KEYS.sidebarCollapsed),
    ).toBe("false");
  });

  it("可完成今日任务并保存状态", async () => {
    const user = userEvent.setup();
    render(<App />);
    const buttons = screen.getAllByRole("button", { name: "标记完成" });
    await user.click(buttons[0]);
    expect(screen.getByRole("button", { name: "已完成" })).toBeInTheDocument();
    expect(useAppStore.getState().progress.completed_tasks).toHaveLength(1);
  });

  it("可进入曲库并按编号搜索第二调", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(
      within(screen.getByRole("navigation", { name: "主导航" })).getByRole(
        "link",
        { name: "诗歌" },
      ),
    );
    const search = await screen.findByPlaceholderText(
      "输入编号或标题，例如 118、奇异恩典",
    );
    await user.type(search, "118b");
    expect(await screen.findByText("神的儿子亲爱救主")).toBeInTheDocument();
    expect(screen.getByText("第二调")).toBeInTheDocument();
  });

  it("可从侧边栏进入由 C 大调起步的难易推荐列表", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(
      within(screen.getByRole("navigation", { name: "主导航" })).getByRole(
        "link",
        { name: "推荐" },
      ),
    );

    expect(
      await screen.findByRole("heading", {
        name: "先把 C 大调弹熟，再认识其他调",
      }),
    ).toBeInTheDocument();
    const stages = screen.getByRole("tablist", {
      name: "学习难度阶段",
    });
    const firstStage = within(stages).getByRole("tab", {
      name: /C 调起步 11 首/u,
    });
    expect(firstStage).toHaveAttribute("aria-selected", "true");

    const firstPanel = screen.getByRole("tabpanel", {
      name: "C 大调 · 稳定起步",
    });
    expect(within(firstPanel).getByText("4/4 拍 · 0–2 次换位")).toBeInTheDocument();
    expect(within(firstPanel).getAllByText("C 大调").length).toBeGreaterThan(0);
    expect(within(firstPanel).getAllByText("4/4 拍").length).toBeGreaterThan(0);

    await user.click(
      within(stages).getByRole("tab", {
        name: /C 调换位 12 首/u,
      }),
    );
    expect(
      screen.getByRole("tabpanel", {
        name: "C 大调 · 开始换位",
      }),
    ).toHaveTextContent("4/4 拍 · 3–4 次换位");
  });

  it("可从主导航进入指法与手位专项", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(
      within(screen.getByRole("navigation", { name: "主导航" })).getByRole(
        "link",
        { name: "指法" },
      ),
    );
    expect(await screen.findByText("指法与手位")).toBeInTheDocument();
    expect(screen.getByText("五条原则")).toBeInTheDocument();
    expect(screen.getByText("十架窄路")).toBeInTheDocument();
    expect(screen.getAllByText(/D 大调/).length).toBeGreaterThan(0);
    expect(screen.getAllByText("5-3-1").length).toBeGreaterThan(0);
  });

  it("空曲单提供去曲库入口", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(
      within(screen.getByRole("navigation", { name: "主导航" })).getByRole(
        "link",
        { name: "曲单" },
      ),
    );
    expect(await screen.findByText("曲单还是空的")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "去曲库选诗歌" })).toBeInTheDocument();
  });

  it("[defect-probing] 第二调练习页不复用原调手位、指法和和弦", async () => {
    window.location.hash = "#/practice/118b";
    render(<App />);
    expect(await screen.findByText("曲目预备方案")).toBeInTheDocument();
    expect(screen.getByText(/第二调暂无独立 SimpMusic PPTX/)).toBeInTheDocument();
    expect(screen.getByText("结构化教学不可用")).toBeInTheDocument();
    expect(screen.queryByText("F 调，1 = F")).not.toBeInTheDocument();
    expect(screen.queryByText("F ｜ C7 ｜ F")).not.toBeInTheDocument();
    expect(screen.queryByText("九步预备法")).not.toBeInTheDocument();
  });

  it("第 1 首显示 PPTX 结构化谱面和逐曲自动编配", async () => {
    window.location.hash = "#/practice/1";
    render(<App />);
    expect(await screen.findByText("逐曲自动编配，使用前请复核")).toBeInTheDocument();
    expect(screen.getAllByText("E♭").length).toBeGreaterThan(0);
    expect(screen.getAllByText("6/8").length).toBeGreaterThan(0);
    expect(screen.getByText("2 / 2 个音符")).toBeInTheDocument();
    expect(screen.getAllByText("E♭ Position").length).toBeGreaterThan(0);
    expect(screen.getByText("E♭·5 · G·3 · B♭·1")).toBeInTheDocument();
    expect(screen.queryByText(/OCR \+ 指法规则候选/)).not.toBeInTheDocument();
  });
});
