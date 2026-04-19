import { RefCrud } from '@/components/RefCrud';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function Settings() {
  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Налаштування</h1>
      <Tabs defaultValue="company">
        <TabsList>
          <TabsTrigger value="company">Реквізити</TabsTrigger>
          <TabsTrigger value="managers">Користувачі</TabsTrigger>
          <TabsTrigger value="trucks">Вантажівки</TabsTrigger>
          <TabsTrigger value="drivers">Водії</TabsTrigger>
          <TabsTrigger value="templates">Шаблони</TabsTrigger>
          <TabsTrigger value="penalties">Warunki</TabsTrigger>
        </TabsList>
        <TabsContent value="company">
          <Card>
            <CardHeader><CardTitle>Bakspeed Sp. z o.o.</CardTitle></CardHeader>
            <CardContent className="text-sm space-y-2">
              <div><b>Адреса:</b> Henryka Sienkiewicza 22/618, 60-818 Poznań, Poland</div>
              <div><b>NIP:</b> 7812023271 · <b>KRS:</b> 0000911850 · <b>REGON:</b> 389468581</div>
              <div><b>TIMOCOM ID:</b> 436346</div>
              <div><b>Bank:</b> Santander Bank Polska S.A. · BIC WBKPPLPPXXX</div>
              <div><b>IBAN EUR:</b> PL46 1090 1362 0000 0001 4837 7635</div>
              <div><b>IBAN PLN:</b> PL64 1090 1362 0000 0001 4837 7602</div>
              <div className="text-xs text-muted-foreground mt-4">SPEED YOU CAN TRUST</div>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="managers">
          <RefCrud title="" table="managers" searchField="full_name"
            columns={[
              { key: 'code', label: 'Код' },
              { key: 'full_name', label: 'Ім’я' },
              { key: 'email', label: 'Email' },
              { key: 'phone', label: 'Телефон' },
              { key: 'telegram_chat_id', label: 'Telegram' },
              { key: 'role', label: 'Роль', options: [
                { value: 'owner', label: 'owner' }, { value: 'manager', label: 'manager' },
                { value: 'accountant', label: 'accountant' }, { value: 'viewer', label: 'viewer' },
              ]},
              { key: 'is_active', label: 'Активний', type: 'boolean' },
            ]}
          />
        </TabsContent>
        <TabsContent value="trucks">
          <RefCrud title="" table="trucks" searchField="name"
            columns={[
              { key: 'name', label: 'Код' },
              { key: 'carrier_id', label: 'Перевізник' },
              { key: 'tractor_plate', label: 'Тягач' },
              { key: 'trailer_plate', label: 'Причіп' },
              { key: 'body_type', label: 'Тип кузова' },
              { key: 'capacity_kg', label: 'Вант., кг', type: 'number' },
              { key: 'loading_meters', label: 'LDM', type: 'number' },
              { key: 'has_adr_equipment', label: 'ADR', type: 'boolean' },
              { key: 'has_thermograph', label: 'Термограф', type: 'boolean' },
              { key: 'is_active', label: 'Активна', type: 'boolean' },
            ]}
          />
        </TabsContent>
        <TabsContent value="drivers">
          <RefCrud title="" table="drivers" searchField="full_name"
            columns={[
              { key: 'full_name', label: 'Ім’я' },
              { key: 'phone', label: 'Телефон' },
              { key: 'carrier_id', label: 'Перевізник' },
              { key: 'licence_number', label: 'Права №' },
              { key: 'licence_expiry', label: 'Права до', type: 'date' },
              { key: 'has_adr_cert', label: 'ADR', type: 'boolean' },
              { key: 'adr_cert_expiry', label: 'ADR до', type: 'date' },
              { key: 'is_active', label: 'Активний', type: 'boolean' },
            ]}
          />
        </TabsContent>
        <TabsContent value="templates">
          <RefCrud title="" table="notification_templates" searchField="code"
            columns={[
              { key: 'code', label: 'Код' },
              { key: 'channel', label: 'Канал', options: [
                { value: 'email', label: 'email' }, { value: 'telegram', label: 'telegram' },
                { value: 'sms', label: 'sms' }, { value: 'whatsapp', label: 'whatsapp' }, { value: 'in_app', label: 'in_app' },
              ]},
              { key: 'language', label: 'Мова' },
              { key: 'subject', label: 'Тема' },
              { key: 'body', label: 'Текст' },
            ]}
          />
        </TabsContent>
        <TabsContent value="penalties">
          <RefCrud title="" table="penalty_rules" canDelete={false} defaultOrder="warunki_point"
            columns={[
              { key: 'warunki_point', label: '#', type: 'number' },
              { key: 'title', label: 'Правило' },
              { key: 'penalty_amount_eur', label: 'Сума €', type: 'number' },
              { key: 'trigger_type', label: 'Тригер' },
              { key: 'is_auto', label: 'Авто', type: 'boolean' },
            ]}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
