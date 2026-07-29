import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PracticeRecorder } from "./PracticeRecorder";
import { useAppStore } from "@/store/useAppStore";

describe("练习记录器", () => {
  it("保存问题、目标与自评", async () => {
    const user = userEvent.setup();
    useAppStore.setState({ records: [] });
    render(<PracticeRecorder hymnKey="118" />);

    await user.type(
      screen.getByPlaceholderText("例如：第 2 段左手换和弦会停一下"),
      "第二段左手会停",
    );
    await user.type(
      screen.getByPlaceholderText("例如：60 BPM 下完整弹两遍，不从头重来"),
      "60 BPM 连续两遍",
    );
    await user.click(screen.getByRole("button", { name: "完成并保存" }));

    expect(screen.getByRole("button", { name: "练习已保存" })).toBeInTheDocument();
    expect(useAppStore.getState().records[0]).toMatchObject({
      hymn_key: "118",
      issue: "第二段左手会停",
      next_goal: "60 BPM 连续两遍",
    });
  });
});
