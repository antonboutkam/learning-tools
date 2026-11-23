# Production
The production environment can be reached at https://learning-tools.devroc.nl/.

- System root: /var/www/dynamic/learning-tools.devroc.nl/current (symlinked)
- Document root: /var/www/dynamic/learning-tools.devroc.nl/current/public_html
- Shared dir: - System root: /var/www/dynamic/learning-tools.devroc.nl/shared (the data dir is shared)
- Server: hurah@devroc.nl
- User that does deployment: deployer:deployer

# Development
Development happens on this domain: http://learning-tools.nuidev.nl/ which is mapped to the sourcecode you are working on at 127.0.0.1. 


## Protocols
1. Please support both the http vs https protocols but only allow https on production environments. 
2. Dev is usually at http but can be also on https. 
3. Production is always on https. 
4. These tools are embedded with iframes, the protocol has to be the same everywhere to make things work correctly.
