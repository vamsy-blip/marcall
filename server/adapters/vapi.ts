export interface IVapiClient {
  createOrg(name: string): Promise<{ orgId: string; publicKey: string; privateKey: string }>;
  createAssistant(orgId: string, cfg: any): Promise<{ assistantId: string }>;
  updateAssistant(assistantId: string, cfg: any): Promise<void>;
  attachPhoneNumber(orgId: string, assistantId: string, e164: string): Promise<{ phoneId: string }>;
}

export class MockVapiClient implements IVapiClient {
  async createOrg(name: string) {
    return { orgId: `org_mock_${Date.now()}`, publicKey: 'pk_mock_xxx', privateKey: 'sk_mock_xxx' };
  }
  async createAssistant(_orgId: string, _cfg: any) {
    return { assistantId: `asst_mock_${Date.now()}` };
  }
  async updateAssistant() { return; }
  async attachPhoneNumber() {
    return { phoneId: `phn_mock_${Date.now()}` };
  }
}

export const vapi: IVapiClient = new MockVapiClient();
