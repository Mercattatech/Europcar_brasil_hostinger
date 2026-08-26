import { NextResponse } from 'next/server';
import { callXRS } from '@/lib/europcar/xrsClient';
import { escapeXml } from '@/lib/europcar/xmlEscape';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const stationCode = (searchParams.get('code') ?? '').trim().toUpperCase();

  if (!stationCode) {
    return NextResponse.json({ error: 'Parâmetro code é obrigatório.' }, { status: 400 });
  }

  try {
    const xmlRequest = `<?xml version="1.0" encoding="UTF-8"?>
<message>
  <serviceRequest serviceCode="getStation">
    <serviceContext>
      <localisation active="true">
        <language code="pt_BR"/>
      </localisation>
    </serviceContext>
    <serviceParameters>
      <station stationCode="${escapeXml(stationCode)}"/>
    </serviceParameters>
  </serviceRequest>
</message>`;

    const config = {
      callerCode: process.env.XRS_CALLER_CODE || '',
      password: process.env.XRS_PASSWORD || '',
      action: 'getStation',
      sourceFile: 'getStation/route.ts',
    };

    const xrsResponse = await callXRS(xmlRequest, config);

    // Navigate to station node — XRS may return different structures
    const raw =
      xrsResponse?.message?.serviceResponse?.station ||
      xrsResponse?.serviceResponse?.station ||
      null;

    if (!raw) {
      return NextResponse.json({ error: 'Estação não encontrada.' }, { status: 404 });
    }

    // Attributes may live in raw.$ or directly on raw
    const attrs = raw.$ || raw;

    // Parse opening hours from <openingHoursList> / <openingHours> / <scheduleList>
    // XRS schema varies — we try multiple known structures
    const hours = parseOpeningHours(raw);

    const station = {
      code:         attrs.stationCode   ?? stationCode,
      name:         attrs.stationName   ?? '',
      address:      [attrs.address1, attrs.address2].filter(Boolean).join(', '),
      city:         attrs.cityName      ?? attrs.city ?? '',
      postalCode:   attrs.postalCode    ?? '',
      country:      attrs.countryName   ?? attrs.countryCode ?? '',
      phone:        attrs.phoneWithInternationalDialling ?? buildPhone(attrs),
      email:        sanitizeEmail(attrs.email ?? ''),
      latitude:     attrs.latitude      ?? '',
      longitude:    attrs.longitude     ?? '',
      type:         attrs.prestige === 'Y' ? 'airport' : 'city',
      leadTime:     attrs.leadTime      ?? '',
      hours,
    };

    return NextResponse.json({ station });

  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Erro ao consultar XRS getStation' },
      { status: 500 }
    );
  }
}

function buildPhone(attrs: any): string {
  const parts = [
    attrs.phoneCountryCode ? `+${attrs.phoneCountryCode}` : '',
    attrs.phoneAreaCode ?? '',
    attrs.phoneNumber ?? '',
  ].filter(Boolean);
  return parts.join(' ');
}

/**
 * Filters out internal / relay email addresses that are not customer-facing.
 * Returns the first valid public email found, or empty string.
 *
 * The XRS API often returns internal Microsoft Exchange relay addresses
 * like "nbe@msk.europcar.com.br;tymyllem.yrh@msk.europcar.com.br"
 * These should never be shown to end-users.
 */
function sanitizeEmail(raw: string): string {
  if (!raw) return '';

  // Internal patterns to block
  const BLOCKED_PATTERNS = [
    /msk\.europcar/i,          // MSK Exchange relay (most common)
    /exchange\./i,             // Generic Exchange relay
    /relay\./i,                // Generic relay
    /noreply/i,                // No-reply addresses
    /no-reply/i,
    /donotreply/i,
    /postmaster/i,
    /mailer-daemon/i,
    /^\s*$/,                   // Empty or whitespace
  ];

  // The field sometimes contains multiple addresses separated by ";" or ","
  const candidates = raw.split(/[;,]/).map(e => e.trim()).filter(Boolean);

  for (const email of candidates) {
    // Basic email format check
    const isValidFormat = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (!isValidFormat) continue;

    // Reject if it matches any blocked pattern
    const isBlocked = BLOCKED_PATTERNS.some(p => p.test(email));
    if (isBlocked) continue;

    // First clean email wins
    return email;
  }

  return ''; // No valid public email found — frontend will hide the field
}

/**
 * Tries several known XRS response structures for opening hours.
 * Returns an array of { day, open, close } objects.
 */
function parseOpeningHours(raw: any): { day: string; open: string; close: string }[] {
  const result: { day: string; open: string; close: string }[] = [];

  // Structure A: <openingHoursList><openingHours day="MON" openTime="08:00" closeTime="20:00"/>
  const listA = raw?.openingHoursList?.openingHours;
  if (listA) {
    const arr = Array.isArray(listA) ? listA : [listA];
    for (const h of arr) {
      const a = h.$ || h;
      if (a.day || a.openTime) {
        result.push({
          day:   translateDay(a.day ?? a.dayOfWeek ?? ''),
          open:  formatTime(a.openTime ?? a.open ?? ''),
          close: formatTime(a.closeTime ?? a.close ?? ''),
        });
      }
    }
    if (result.length) return result;
  }

  // Structure B: <scheduleList><schedule dayOfWeek="1" openTime="..." closeTime="..."/>
  const listB = raw?.scheduleList?.schedule;
  if (listB) {
    const arr = Array.isArray(listB) ? listB : [listB];
    for (const h of arr) {
      const a = h.$ || h;
      result.push({
        day:   translateDayNumber(String(a.dayOfWeek ?? a.day ?? '')),
        open:  formatTime(a.openTime ?? a.open ?? ''),
        close: formatTime(a.closeTime ?? a.close ?? ''),
      });
    }
    if (result.length) return result;
  }

  // Structure C: hours array already normalised (mock / fallback)
  if (Array.isArray(raw?.hours)) {
    return raw.hours.map((h: any) => ({
      day:   h.day ?? '',
      open:  h.open ?? h.openTime ?? '',
      close: h.close ?? h.closeTime ?? '',
    }));
  }

  return result;
}

const DAY_MAP: Record<string, string> = {
  MON: 'Seg', TUE: 'Ter', WED: 'Qua', THU: 'Qui',
  FRI: 'Sex', SAT: 'Sáb', SUN: 'Dom',
  MONDAY: 'Seg', TUESDAY: 'Ter', WEDNESDAY: 'Qua', THURSDAY: 'Qui',
  FRIDAY: 'Sex', SATURDAY: 'Sáb', SUNDAY: 'Dom',
};

const DAY_NUM_MAP: Record<string, string> = {
  '1': 'Seg', '2': 'Ter', '3': 'Qua', '4': 'Qui',
  '5': 'Sex', '6': 'Sáb', '7': 'Dom',
  '0': 'Dom', // some APIs use 0 = Sunday
};

function translateDay(d: string): string {
  return DAY_MAP[d.toUpperCase()] ?? d;
}

function translateDayNumber(n: string): string {
  return DAY_NUM_MAP[n] ?? n;
}

function formatTime(t: string): string {
  if (!t) return '';
  // Normalize "0800" → "08:00", "08:00" stays, "8" → "08:00"
  const clean = t.replace(':', '');
  if (clean.length === 4) return `${clean.slice(0, 2)}:${clean.slice(2)}`;
  if (clean.length === 3) return `0${clean.slice(0, 1)}:${clean.slice(1)}`;
  return t;
}
