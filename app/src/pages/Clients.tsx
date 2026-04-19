import { RefCrud } from '@/components/RefCrud';

export default function Clients() {
  return (
    <RefCrud
      title="Клієнти"
      table="clients"
      searchField="company_name"
      columns={[
        { key: 'company_name', label: 'Компанія' },
        { key: 'nip', label: 'NIP' },
        { key: 'country', label: 'Країна' },
        { key: 'city', label: 'Місто' },
        { key: 'default_currency', label: 'Валюта', options: [{ value: 'EUR', label: 'EUR' }, { value: 'PLN', label: 'PLN' }] },
        { key: 'default_payment_term_days', label: 'Термін, дн', type: 'number' },
        { key: 'risk_tag', label: 'Теги' },
      ]}
    />
  );
}
