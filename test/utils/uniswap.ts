import UniswapV2FactoryContract from '@uniswap/v2-core/build/UniswapV2Factory.json';
import UniswapV2Router02Contract from '@uniswap/v2-periphery/build/UniswapV2Router02.json';
import IUniswapV2Pair from '@uniswap/v2-core/build/IUniswapV2Pair.json';
import WETHContract from '@uniswap/v2-periphery/build/WETH9.json';
import { deployContract } from 'ethereum-waffle';
import { BigNumber, Contract, Signer } from 'ethers';
import { ethers } from 'hardhat';

let WETH: Contract, uniswapV2Factory: Contract, uniswapV2Router02: Contract;

export const getWETH = () => WETH;
export const getUniswapV2Factory = () => uniswapV2Factory;
export const getUniswapV2Router02 = () => uniswapV2Router02;

export const deadline: BigNumber = ethers.BigNumber.from('2').pow('256').sub('2');

export const deploy = async ({ owner }: { owner: Signer }) => {
  WETH = await deployContract(owner, WETHContract);
  uniswapV2Factory = await deployContract(owner, UniswapV2FactoryContract, [await owner.getAddress()]);
  uniswapV2Router02 = await deployContract(owner, UniswapV2Router02Contract, [uniswapV2Factory.address, WETH.address], { gasLimit: 9500000 });
  return {
    WETH,
    uniswapV2Factory,
    uniswapV2Router02,
  };
};

export const createPair = async (token0: string, token1: string) => {
  await uniswapV2Factory.createPair(token0, token1);
  const pairAddress = await uniswapV2Factory.getPair(token0, token1);
  const pair = await ethers.getContractAt(IUniswapV2Pair.abi, pairAddress);
  return pair;
};

export const addLiquidity = async ({
  owner,
  token0,
  amountA,
  token1,
  amountB,
}: {
  owner: Signer;
  token0: Contract;
  amountA: BigNumber;
  token1: Contract;
  amountB: BigNumber;
}) => {
  await token0.connect(owner).approve(uniswapV2Router02.address, amountA);
  await token1.connect(owner).approve(uniswapV2Router02.address, amountB);
  await uniswapV2Router02
    .connect(owner)
    .addLiquidity(token0.address, token1.address, amountA, amountB, amountA, amountB, await owner.getAddress(), deadline, {
      gasLimit: 9500000,
    });
};

export const addLiquidityETH = async ({
  owner,
  token0,
  token0mount,
  wethAmount,
}: {
  owner: Signer;
  token0: Contract;
  token0mount: BigNumber;
  wethAmount: BigNumber;
}) => {
  await token0.connect(owner).approve(uniswapV2Router02.address, token0mount);
  await uniswapV2Router02
    .connect(owner)
    .addLiquidityETH(token0.address, token0mount, token0mount, wethAmount, await owner.getAddress(), deadline, {
      gasLimit: 9500000,
      value: wethAmount,
    });
};
