one.trust

## Available:

Create person  
Create keys

## Available, untested:

Use keys to create verifiable credential  
Use keys from verifiable credential to sign another verifiable credential

## To be implemented:

Create a certificate authority to check for latest versions of a verifiable credential

Create peer storage to carry new versions of verifiable credentials 

Create a verifiable credential for an id for a number of months  
Create a verifiable credential for an id for a dedicated timeframe  
Create a new version of a verifiable credential for an id for a dedicated timeframe

Invalidate verifiable credential by 

1. creating a new version with e.g. valid end time in the past or nearer future  
2. propagating this new version via peer storage and certificate authority  
3. document usage attempts of invalid credentials and the authorities involved, e.g. who tried, who verified, who documents

