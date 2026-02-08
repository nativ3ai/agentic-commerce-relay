import { ethers } from 'hardhat';

async function main(): Promise<void> {
  const [deployer] = await ethers.getSigners();
  const Mock = await ethers.getContractFactory('MockUSDC');
  const mock = await Mock.deploy(1_000_000_000, deployer.address);
  await mock.waitForDeployment();
  console.log(`MockUSDC: ${await mock.getAddress()}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
