import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppModule } from './app.module';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  it('returns a simulation-only platform overview', () => {
    expect(appController.getOverview()).toMatchObject({
      mode: 'demo',
      bankingRailsMode: 'simulation',
      liveBankingNetworksConnected: false,
      portals: ['User Net Banking Portal', 'Master Admin Portal'],
    });
  });

  it('returns a healthy status', () => {
    expect(appController.getHealth()).toMatchObject({
      status: 'ok',
      demoBankingMode: true,
      bankingRailsMode: 'simulation',
    });
  });
});
