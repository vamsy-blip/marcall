export interface ITwilioClient {
  createSubaccount(name: string): Promise<{ sid: string; authToken: string }>;
  buyNumber(subSid: string, country: string): Promise<{ sid: string; e164: string }>;
  releaseNumber(sid: string): Promise<void>;
}

export class MockTwilioClient implements ITwilioClient {
  async createSubaccount(name: string) {
    return { sid: `AC_mock_${Date.now()}`, authToken: 'tok_mock_xxx' };
  }
  async buyNumber(_sub: string, country: string) {
    const cc = country === 'MX' ? '+52' : '+1';
    const num = Math.floor(1000000000 + Math.random() * 9000000000);
    return { sid: `PN_mock_${Date.now()}`, e164: `${cc}${num}` };
  }
  async releaseNumber() { return; }
}

export const twilio: ITwilioClient = new MockTwilioClient();
