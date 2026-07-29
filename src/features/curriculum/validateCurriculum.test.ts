import { curriculum, curriculumPhases } from "@/data/curriculum";
import { validateCurriculum } from "./validateCurriculum";

describe("48 周课程", () => {
  it("覆盖八个阶段与连续 48 周", () => {
    expect(curriculumPhases).toHaveLength(8);
    expect(curriculum).toHaveLength(48);
    expect(curriculum.map((week) => week.week)).toEqual(
      Array.from({ length: 48 }, (_, index) => index + 1),
    );
  });

  it("每周三次、每次 60 分钟且结构完整", () => {
    expect(validateCurriculum(curriculum)).toEqual([]);
    for (const week of curriculum) {
      expect(week.days).toHaveLength(3);
      for (const day of week.days) {
        expect(
          day.tasks.reduce((total, task) => total + task.minutes, 0),
        ).toBe(60);
      }
    }
  });

  it("第 37 周起每周包含服侍模拟", () => {
    for (const week of curriculum.slice(36)) {
      expect(
        week.days.some((day) =>
          day.tasks.some((task) => task.kind === "service_simulation"),
        ),
      ).toBe(true);
    }
  });
});
