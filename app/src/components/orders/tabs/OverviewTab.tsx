import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency, formatDate, formatEUR } from '@/lib/utils';

export function OverviewTab({ order }: { order: any; onSaved?: () => void }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <Card>
        <CardHeader><CardTitle>Завантаження</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          <Row label="Місце" value={`${order.loading_place ?? '—'}`} />
          <Row label="Адреса" value={order.loading_address} />
          <Row label="Дата" value={formatDate(order.loading_date)} />
          <Row label="Час" value={`${order.loading_time_from ?? ''}–${order.loading_time_to ?? ''}`} />
          <Row label="Reference" value={order.loading_reference} />
          <Row label="Контакт" value={order.loading_contact_name} />
          <Row label="Телефон" value={order.loading_contact_phone} />
          <Row label="Нотатки" value={order.loading_notes} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Розвантаження</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          <Row label="Місце" value={`${order.unloading_place ?? '—'}`} />
          <Row label="Адреса" value={order.unloading_address} />
          <Row label="Дата" value={formatDate(order.unloading_date)} />
          <Row label="Час" value={`${order.unloading_time_from ?? ''}–${order.unloading_time_to ?? ''}`} />
          <Row label="Reference" value={order.unloading_reference} />
          <Row label="Контакт" value={order.unloading_contact_name} />
          <Row label="Телефон" value={order.unloading_contact_phone} />
          <Row label="Нотатки" value={order.unloading_notes} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Вантаж</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          <Row label="Тип" value={order.goods_type} />
          <Row label="Вага" value={order.weight_kg ? `${order.weight_kg} кг` : null} />
          <Row label="LDM" value={order.loading_meters} />
          <Row label="Волюм" value={order.volume_m3 ? `${order.volume_m3} м³` : null} />
          <Row label="ADR" value={order.adr ? `так${order.adr_class ? ` (${order.adr_class})` : ''}` : 'ні'} />
          <Row label="Температура" value={order.temperature_required ? `${order.temperature_min ?? '−'}…${order.temperature_max ?? '−'}°C` : '—'} />
          <Row label="Палети" value={order.pallets_count ? `${order.pallets_count} × ${order.pallets_type ?? ''}` : null} />
          <Row label="Stackable" value={order.stackable ? 'так' : 'ні'} />
          <Row label="Обмін палет" value={order.pallets_exchange_required ? 'так' : 'ні'} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Клієнт</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          <Row label="Компанія" value={order.client?.company_name} />
          <Row label="NIP" value={order.client?.nip} />
          <Row label="Менеджер" value={order.manager?.code} />
          <Row label="Замовлення клієнта №" value={order.client_order_number} />
          <Row label="Контакт" value={order.client_contact?.full_name} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Виконавець</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          <Row label="Перевізник" value={order.carrier?.company_name} />
          <Row label="Власний флот" value={order.carrier?.is_own_fleet ? 'так' : 'ні'} />
          <Row label="Вантажівка" value={order.truck?.name} />
          <Row label="Плати" value={`${order.truck?.tractor_plate ?? ''} / ${order.truck?.trailer_plate ?? ''}`} />
          <Row label="Водій" value={order.driver?.full_name} />
          <Row label="Телефон водія" value={order.driver?.phone} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Фінанси</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm numeric">
          <Row label="Оборот netto" value={`${formatCurrency(order.turnover_netto_original, order.client_currency)} = ${formatEUR(order.turnover_netto_eur)}`} />
          <Row label="VAT клієнта" value={`${((order.vat_client_rate ?? 0) * 100).toFixed(0)}%`} />
          <Row label="Перевізнику netto" value={`${formatCurrency(order.price_carrier_netto_original, order.carrier_currency)} = ${formatEUR(order.price_carrier_netto_eur)}`} />
          <Row label="Маржа" value={formatEUR(order.delta_netto_eur)} />
          <Row label="Курс NBP" value={order.nbp_pln_per_eur ? `${order.nbp_pln_per_eur} PLN/EUR · ${order.nbp_rate_date}` : '—'} />
          <Row label="€/км" value={order.price_per_km_eur ? Number(order.price_per_km_eur).toFixed(2) : '—'} />
          <Row label="Всього км" value={order.all_km} />
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ label, value }: { label: string; value: any }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value ?? '—'}</span>
    </div>
  );
}
