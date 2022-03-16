const fs = require('fs');

const pathPrefix = __dirname + '/packages/components';

// const buildTreeNode = dep => {
//   return { [dep]: loadDependencies(dep).map(buildTreeNode) };
// };

const loadDependencies = packageName => {
  let packageJsonFile;
  const path = pathPrefix + '/' + packageName + '/package.json';

  try {
    packageJsonFile = fs.readFileSync(path);
  } catch {
    return null;
  }

  const { dependencies } = JSON.parse(packageJsonFile);

  return dependencies ? Object.keys(dependencies) : null;
};

(() => {
  const files = fs.readdirSync(pathPrefix);

  const rootDependencies = files.filter(file => {
    const dependencies = loadDependencies(file);
    if (dependencies) {
      // console.log(Object.keys(dependencies));
      return !Object.keys(dependencies).some(dependency => {
        const allowedBBCDeps = ['@bbc/psammead-styles', '@bbc/gel-foundations'];
        if (allowedBBCDeps.includes(dependency)) {
          return false;
        }
        return dependency.startsWith('@bbc');
      });
    }
    return false;
  });

  const usages = rootDependencies.map(dep => {
    const references = files.filter(file => {
      const dependencies = loadDependencies(file);
      return dependencies ? dependencies.includes('@bbc/' + dep) : null;
    });
    return { [dep]: references };
  });

  usages.forEach(file => console.log(file));
})();
