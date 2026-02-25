import * as RE from 'rogue-engine';
import * as THREE from 'three';
import { FMLog } from './FocusLogger';

/**
 * A standalone utility class for finding, instantiating, and managing prefabs.
 * This class is designed to be used without extensive dependencies on other libraries like matelib.
 */
export class PrefabUtil {

    private static wait(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Asynchronously finds a prefab's full path from its name or a partial path.
     * This method will wait and retry for a short period if the engine's prefab list
     * is not yet populated, preventing race conditions on startup.
     * @param nameOrPath The simple name (e.g., "MyPrefab") or path (e.g., "Enemies/Goblin") of the prefab.
     * @param retries The number of times to check for the prefab list before failing.
     * @param delay The delay in milliseconds between retries.
     * @returns A promise that resolves to the full, normalized prefab path or null if not found.
     */
    public static async find(nameOrPath: string, retries: number = 5, delay: number = 50): Promise<string | null> {
        // Wait for the prefab list to be populated, retrying a few times.
        for (let i = 0; i < retries; i++) {
            if (Object.keys(RE.Prefab.namedPrefabUUIDs).length > 0) {
                break; // List is populated, we can proceed
            }
            await this.wait(delay);
        }

        const namedUUIDs = RE.Prefab.namedPrefabUUIDs;
        if (Object.keys(namedUUIDs).length === 0) {
            FMLog.log('error', `Prefab list is empty. Could not find "${nameOrPath}".`);
            return null;
        }

        // Normalize input: remove .roguePrefab extension if present and normalize slashes
        let normalizedNameOrPath = nameOrPath.endsWith('.roguePrefab')
            ? nameOrPath.slice(0, -'.roguePrefab'.length)
            : nameOrPath;
        normalizedNameOrPath = normalizedNameOrPath.replace(/\\/g, '/'); // Ensure input also uses forward slashes

        const allNormalizedPrefabKeys = Object.keys(namedUUIDs).map(p => p.replace(/\\/g, '/')); // Normalize keys from RE.Prefab.namedPrefabUUIDs

        // 1. Exact match with normalized path
        if (allNormalizedPrefabKeys.includes(normalizedNameOrPath)) {
            return normalizedNameOrPath;
        }

        // 2. Case-insensitive match for full path
        const lowerCaseNormalizedNameOrPath = normalizedNameOrPath.toLowerCase();
        const caseInsensitiveMatch = allNormalizedPrefabKeys.find(p => p.toLowerCase() === lowerCaseNormalizedNameOrPath);
        if (caseInsensitiveMatch) {
            return caseInsensitiveMatch;
        }

        // 3. Handle simple names (no slashes in input)
        if (!normalizedNameOrPath.includes('/')) {
            const matchingPaths = allNormalizedPrefabKeys.filter(p => {
                const fileName = p.substring(p.lastIndexOf('/') + 1);
                return fileName.toLowerCase() === lowerCaseNormalizedNameOrPath; // Case-insensitive match for file name
            });

            if (matchingPaths.length === 1) {
                return matchingPaths[0];
            }
            if (matchingPaths.length > 1) {
                FMLog.log('error', `Ambiguous prefab name "${nameOrPath}". Found multiple matches.`, matchingPaths);
                return null;
            }
        }

        FMLog.log('error', `Could not resolve prefab name or path: "${nameOrPath}"`);
        return null;
    }

    public static async fetch(nameOrPath: string): Promise<RE.Prefab | null> {
        let path = await this.find(nameOrPath);
        if (!path) {
            FMLog.log('error', `Could not fetch prefab. Prefab not found: "${nameOrPath}"`);
            return null;
        }

        try {
            const prefab = await RE.Prefab.fetch(path);
            return prefab;
        } catch (error) {
            FMLog.log('error', `Error fetching prefab "${path}"`, error);
            return null;
        }
    }

    public static async get(nameOrPath: string): Promise<RE.Prefab | null> {
        let path = await this.find(nameOrPath);
        if (!path) {
            return null;
        }

        try {
            return RE.Prefab.get(path);
        } catch (error) {
            FMLog.log('warn', `Could not get prefab for "${path}". It may not be preloaded.`);
            return null;
        }
    }

    public static async preload(nameOrPaths: string | string[]): Promise<void> {
        const paths = Array.isArray(nameOrPaths) ? nameOrPaths : [nameOrPaths];
        const fetchPromises = paths.map(p => this.fetch(p).catch(e => FMLog.log('error', `Failed to preload prefab`, e)));
        await Promise.all(fetchPromises);
    }

    public static getAllPaths(basePath: string = ""): string[] {
        const namedUUIDs = RE.Prefab.namedPrefabUUIDs;
        let allPaths = Object.keys(namedUUIDs);

        // Normalize all paths to use forward slashes
        allPaths = allPaths.map(p => p.replace(/\\/g, '/'));

        if (!basePath) {
            return allPaths;
        }

        return allPaths.filter(path => path.startsWith(basePath));
    }

    public static async instantiate(
        nameOrPath: string,
        options: {
            parent?: THREE.Object3D | null;
            position?: THREE.Vector3;
            rotation?: THREE.Euler;
            scale?: THREE.Vector3;
            name?: string;
        } = {}
    ): Promise<THREE.Object3D | null> {
        let path = await this.find(nameOrPath);
        if (!path) {
            return null;
        }

        try {
            // Defensive step: Ensure path passed to RE.Prefab.instantiate is without .roguePrefab extension
            if (path.endsWith('.roguePrefab')) {
                path = path.slice(0, -'.roguePrefab'.length);
            }
            
            const instance = await RE.Prefab.instantiate(path);
            if (!instance) {
                FMLog.log('error', `RE.Prefab.instantiate failed for path: ${path}`);
                return null;
            }

            // Add metadata to the instance for later identification
            instance.userData.isPrefab = true;
            instance.userData.prefabPath = path;

            if (options.parent !== undefined) {
                instance.removeFromParent();
                if (options.parent) {
                    options.parent.add(instance);
                }
            }

            if (options.position) instance.position.copy(options.position);
            if (options.rotation) instance.rotation.copy(options.rotation);
            if (options.scale) instance.scale.copy(options.scale);
            if (options.name) instance.name = options.name;

            return instance;
        } catch (error) {
            FMLog.log('error', `Error during instantiation of prefab "${path}"`, error);
            return null;
        }
    }

    public static async instantiateMultiple(...namesOrPaths: string[]): Promise<THREE.Object3D[]> {
        const instantiationPromises = namesOrPaths.map(nameOrPath => this.instantiate(nameOrPath));
        const instances = await Promise.all(instantiationPromises);
        return instances.filter((instance): instance is THREE.Object3D => instance !== null);
    }

    public static destroy(object: THREE.Object3D, disposeAssets: boolean = false): void {
        if (!object) return;

        if (disposeAssets) {
            object.traverse(child => {
                if (child instanceof THREE.Mesh) {
                    child.geometry?.dispose();

                    const material = child.material as THREE.Material | THREE.Material[];
                    if (Array.isArray(material)) {
                        material.forEach(mat => mat.dispose());
                    } else if (material) {
                        material.dispose();
                    }
                }
            });
        }

        object.removeFromParent();
    }
}