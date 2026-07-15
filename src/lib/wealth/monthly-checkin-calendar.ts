const MONTH_KEY_PATTERN = /^(\d{4})-(0[1-9]|1[0-2])$/;

export type MonthlyCheckinCalendar = {
  content: string;
  filename: string;
  mimeType: "text/calendar;charset=utf-8";
};

function compactDate(date: Date) {
  return date.toISOString().slice(0, 10).replaceAll("-", "");
}

export function createMonthlyCheckinCalendar(
  monthKey: string,
): MonthlyCheckinCalendar {
  const match = MONTH_KEY_PATTERN.exec(monthKey);
  if (!match) throw new Error("monthKey must use YYYY-MM format.");

  const year = Number(match[1]);
  const month = Number(match[2]);
  const checkinDate = new Date(Date.UTC(year, month, 0));
  const followingDate = new Date(Date.UTC(year, month, 1));
  const start = compactDate(checkinDate);
  const end = compactDate(followingDate);

  return {
    content: [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//WealthCopy//Monthly Action Check-in//KO",
      "CALSCALE:GREGORIAN",
      "BEGIN:VEVENT",
      `UID:wealthcopy-${monthKey}-checkin@wealthcopy.local`,
      `DTSTART;VALUE=DATE:${start}`,
      `DTEND;VALUE=DATE:${end}`,
      "SUMMARY:WealthCopy 월말 행동 점검",
      "DESCRIPTION:이번 달 행동 3개의 완료 상태를 확인하고 다음 달 계획을 새로 준비합니다.",
      "TRANSP:TRANSPARENT",
      "END:VEVENT",
      "END:VCALENDAR",
      "",
    ].join("\r\n"),
    filename: `wealthcopy-${monthKey}-checkin.ics`,
    mimeType: "text/calendar;charset=utf-8",
  };
}
