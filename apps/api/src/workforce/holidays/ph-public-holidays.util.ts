export type PhilippinesPublicHoliday = {
  date: string;
  localName: string;
  name: string;
  countryCode: string;
  fixed: boolean;
  global: boolean;
  counties: string[] | null;
  launchYear: number | null;
  types: string[];
};

export async function fetchPhilippinesPublicHolidays(
  year: number,
): Promise<PhilippinesPublicHoliday[]> {
  const response = await fetch(
    `https://date.nager.at/api/v3/PublicHolidays/${year}/PH`,
  );

  if (!response.ok) {
    throw new Error('Unable to fetch Philippines public holidays.');
  }

  const holidays = (await response.json()) as PhilippinesPublicHoliday[];

  return holidays.sort((left, right) => left.date.localeCompare(right.date));
}

export function serializePhilippinesPublicHoliday(
  holiday: PhilippinesPublicHoliday,
) {
  return {
    date: holiday.date,
    localName: holiday.localName,
    name: holiday.name,
    types: holiday.types,
  };
}
