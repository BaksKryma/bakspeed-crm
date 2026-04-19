import { RefCrud } from '@/components/RefCrud';

export default function Carriers() {
  return (
    <RefCrud
      title="Перевізники"
      table="carriers"
      searchField="company_name"
      columns={[
        { key: 'company_name', label: 'Компанія' },
        { key: 'nip', label: 'NIP' },
        { key: 'country', label: 'Країна' },
        { key: 'is_own_fleet', label: 'Власний', type: 'boolean', render: (v) => v ? '✓' : '' },
        { key: 'default_payment_term_days', label: 'Термін, дн', type: 'number' },
        { key: 'default_currency', label: 'Валюта', options: [{ value: 'EUR', label: 'EUR' }, { value: 'PLN', label: 'PLN' }] },
        { key: 'ocp_insurance_expiry', label: 'OCP до', type: 'date' },
        { key: 'ocp_insurance_sum_eur', label: 'OCP сума €', type: 'number' },
        { key: 'rating', label: 'Рейтинг', type: 'number' },
      ]}
    />
  );
}
