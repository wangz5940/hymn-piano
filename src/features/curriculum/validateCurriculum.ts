import type { CurriculumWeek, PracticeKind } from "./types";

const requiredKinds: readonly PracticeKind[] = [
  "warmup",
  "method",
  "accompaniment",
  "repertoire",
];

export function validateCurriculum(
  curriculum: readonly CurriculumWeek[],
): string[] {
  const errors: string[] = [];

  if (curriculum.length !== 48) {
    errors.push(`课程应为 48 周，实际为 ${curriculum.length} 周`);
  }

  curriculum.forEach((week, weekIndex) => {
    const expectedWeek = weekIndex + 1;
    if (week.week !== expectedWeek) {
      errors.push(`第 ${expectedWeek} 个周对象的周次为 ${week.week}`);
    }
    if (week.days.length !== 3) {
      errors.push(`第 ${week.week} 周应有 3 次练习`);
    }

    week.days.forEach((day) => {
      const totalMinutes = day.tasks.reduce(
        (total, task) => total + task.minutes,
        0,
      );
      if (totalMinutes < 55 || totalMinutes > 65) {
        errors.push(
          `第 ${week.week} 周第 ${day.day} 次练习时长为 ${totalMinutes} 分钟`,
        );
      }
      for (const kind of requiredKinds) {
        if (!day.tasks.some((task) => task.kind === kind)) {
          errors.push(`第 ${week.week} 周第 ${day.day} 次缺少 ${kind}`);
        }
      }
      if (
        !day.tasks.some(
          (task) =>
            task.kind === "sight_reading" ||
            task.kind === "service_simulation",
        )
      ) {
        errors.push(`第 ${week.week} 周第 ${day.day} 次缺少视奏或服侍模拟`);
      }
    });

    if (
      week.week >= 37 &&
      !week.days.some((day) =>
        day.tasks.some((task) => task.kind === "service_simulation"),
      )
    ) {
      errors.push(`第 ${week.week} 周缺少服侍模拟`);
    }
  });

  return errors;
}
