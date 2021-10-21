import { BigNumberish } from 'ethers';
import { e18, ZERO_ADDRESS } from './web3-utils';

export interface v2Strategy {
  name: string;
  added: boolean;
  amount: BigNumberish;
  address: string;
  costToken?: string;
  costPair?: string;
}

export const v2FtmHarvestStrategies: v2Strategy[] = [
  // {
  //   name: 'StrategyName',
  //   added: false,
  //   amount: 2_800_000,
  //   address: '0x0000000000000000000000000000000000000000',
  // },
];

export const v2FtmTendStrategies: v2Strategy[] = [];
