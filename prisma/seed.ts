import * as fs from 'node:fs';
import * as path from 'node:path';
import { PrismaClient, FinalEntry } from '../generated/prisma/client';

import { PrismaPg } from '@prisma/adapter-pg';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL is not set');

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

const CONTEST = { year: 2026, city: 'Vienna' };

type CountryRow = { name: string; code: string };

type ParticipantRow = {
  country: string;
  artist: string;
  song: string;
  pointsFromAudienceSemi: number | null;
  pointsFromJurySemi: number | null;
  pointsFromAudienceFinal: number | null;
  pointsFromJuryFinal: number | null;
  semiNumber: number | null;
  semiPlacement: number | null;
  finalPlacement: number | null;
  finalEntry: FinalEntry;
};

function readJson<T>(file: string): T {
  const full = path.join(__dirname, 'data', file);
  return JSON.parse(fs.readFileSync(full, 'utf-8')) as T;
}

function checkPlacements(label: string, placements: number[]): string[] {
  const errors: string[] = [];
  const seen = new Set<number>();

  for (const p of placements) {
    if (seen.has(p)) errors.push(`${label}: placement ${p} appears more than once`);
    seen.add(p);
  }
  for (let i = 1; i <= placements.length; i++) {
    if (!seen.has(i)) errors.push(`${label}: placement ${i} is missing`);
  }
  return errors;
}

function checkOrder(
  label: string,
  rows: { country: string; points: number; placement: number }[],
): string[] {
  const errors: string[] = [];
  const sorted = [...rows].sort((a, b) => a.placement - b.placement);

  for (let i = 1; i < sorted.length; i++) {
    const above = sorted[i - 1];
    const below = sorted[i];
    if (below.points > above.points) {
      errors.push(
        `${label}: ${below.country} scored ${below.points} at place ${below.placement}, ` +
          `but ${above.country} scored ${above.points} at place ${above.placement}`,
      );
    }
  }
  return errors;
}

function validate(rows: ParticipantRow[], countries: CountryRow[]): string[] {
  const errors: string[] = [];

  for (const semi of [1, 2]) {
    const inSemi = rows.filter((r) => r.semiNumber === semi);
    if (inSemi.length === 0) continue;

    errors.push(
      ...checkPlacements(`Semi-final ${semi}`, inSemi.map((r) => r.semiPlacement!)),
    );
    errors.push(
      ...checkOrder(
        `Semi-final ${semi}`,
        inSemi.map((r) => ({
          country: r.country,
          points: (r.pointsFromAudienceSemi ?? 0) + (r.pointsFromJurySemi ?? 0),
          placement: r.semiPlacement!,
        })),
      ),
    );
  }

  const finalists = rows.filter((r) => r.finalPlacement !== null);
  errors.push(...checkPlacements('Final', finalists.map((r) => r.finalPlacement!)));
  errors.push(
    ...checkOrder(
      'Final',
      finalists.map((r) => ({
        country: r.country,
        points: (r.pointsFromAudienceFinal ?? 0) + (r.pointsFromJuryFinal ?? 0),
        placement: r.finalPlacement!,
      })),
    ),
  );

  const known = new Set(countries.map((c) => c.name));
  for (const r of rows) {
    if (!known.has(r.country)) errors.push(`Unknown country: ${r.country}`);
  }

  return errors;
}

async function main() {
  const countries = readJson<CountryRow[]>('countries.json');
  const participants = readJson<ParticipantRow[]>('participants-2026.json');

  const errors = validate(participants, countries);
  if (errors.length > 0) {
    console.error(`Validation failed (${errors.length} problems):`);
    errors.forEach((e) => console.error('  - ' + e));
    throw new Error('Seed aborted — input data is inconsistent.');
  }

  for (const c of countries) {
    await prisma.country.upsert({
      where: { code: c.code },
      update: { name: c.name },
      create: c,
    });
  }

  const saved = await prisma.country.findMany({ select: { id: true, name: true } });
  const idByName = new Map(saved.map((c) => [c.name, c.id]));

  const contest = await prisma.contest.upsert({
    where: { year: CONTEST.year },
    update: { city: CONTEST.city },
    create: CONTEST,
  });

  for (const r of participants) {
    const countryId = idByName.get(r.country)!;
    const { country, ...fields } = r;

    await prisma.participant.upsert({
      where: { contestId_countryId: { contestId: contest.id, countryId } },
      update: fields,
      create: { ...fields, contestId: contest.id, countryId },
    });
  }

  console.log(
    `Seeded ${countries.length} countries, contest ${CONTEST.year} (${CONTEST.city}), ` +
      `${participants.length} participants.`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());