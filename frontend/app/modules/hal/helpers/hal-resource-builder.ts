import {HalResource} from 'core-app/modules/hal/resources/hal-resource';
import {OpenprojectHalModuleHelpers} from 'core-app/modules/hal/helpers/lazy-accessor';
import {HalResourceService} from 'core-app/modules/hal/services/hal-resource.service';
import {HalLink} from 'core-app/modules/hal/hal-link/hal-link';

const ObservableArray:any = require('observable-array');

export function initializeHalProperties<T extends HalResource>(halResourceService:HalResourceService, halResource:T) {
    setSource();
    setupLinks();
    setupEmbedded();
    proxyProperties();
    setLinksAsProperties();
    setEmbeddedAsProperties();

  function setSource() {
    if (!halResource.$source._links) {
      halResource.$source._links = {};
    }

    if (!halResource.$source._links.self) {
      halResource.$source._links.self = { href: null };
    }
  }

  function proxyProperties() {
    halResource.$embeddableKeys().forEach((property:any) => {
      Object.defineProperty(halResource, property, {
        get() {
          const value = halResource.$source[property];
          if (value && (value._type || value.type)) {
            return halResourceService.createHalResource(value);
          } else {
            return value;
          }
        },

        set(value) {
          halResource.$source[property] = value;
        },

        enumerable: true,
        configurable: true
      });
    });
  }

  function setLinksAsProperties() {
    halResource.$linkableKeys().forEach((linkName:string) => {
      OpenprojectHalModuleHelpers.lazy(halResource, linkName,
        () => {
          const link:any = halResource.$links[linkName].$link || halResource.$links[linkName];

          if (Array.isArray(link)) {
            var items = link.map(item => halResourceService.createLinkedResource(halResource.constructor._type, linkName, item.$link));
            var property:HalResource[] = new ObservableArray(...items).on('change', () => {
              property.forEach(item => {
                if (!item.$link) {
                  property.splice(property.indexOf(item), 1);
                }
              });

              halResource.$source._links[linkName] = property.map(item => item.$link);
            });

            return property;
          }

          if (link.href) {
            if (link.method !== 'get') {
              return HalLink.fromObject(halResourceService, link).$callable();
            }

            return halResourceService.createLinkedResource(halResource.constructor._type, linkName, link);
          }

          return null;
        },
        (val:any) => setter(val, linkName)
      );
    });
  }

  function setEmbeddedAsProperties() {
    if (!halResource.$source._embedded) {
      return;
    }

    Object.keys(halResource.$source._embedded).forEach(name => {
      OpenprojectHalModuleHelpers.lazy(halResource,
        name,
        () => halResource.$embedded[name],
        (val:any) => setter(val, name));
    });
  }

  function setupProperty(name:string, callback:(element:any) => any) {
    const instanceName = '$' + name;
    const sourceName = '_' + name;
    const sourceObj = halResource.$source[sourceName];

    if (angular.isObject(sourceObj)) {
      Object.keys(sourceObj).forEach(propName => {
        OpenprojectHalModuleHelpers.lazy((halResource)[instanceName],
          propName,
          () => callback(sourceObj[propName]));
      });
    }
  }

  function setupLinks() {
    setupProperty('links',
      (link) => {
        if (Array.isArray(link)) {
          return link.map(l => HalLink.fromObject(halResourceService, l).$callable());
        } else {
          return HalLink.fromObject(halResourceService, link).$callable();
        }
      });
  }

  function setupEmbedded() {
    setupProperty('embedded', element => {
      angular.forEach(element, (child:any, name:string) => {
        if (child && (child._embedded || child._links)) {
          OpenprojectHalModuleHelpers.lazy(element,
            name,
            () => halResourceService.createHalResource(child));
        }
      });

      if (Array.isArray(element)) {
        return element.map((source) => halResourceService.createHalResource(source,
          true));
      }

      return halResourceService.createHalResource(element);
    });
  }

  function setter(val:HalResource|{ href?:string }, linkName:string) {
    if (!val) {
      halResource.$source._links[linkName] = { href: null };
    } else if (_.isArray(val)) {
      halResource.$source._links[linkName] = val.map((el:any) => {
        return { href: el.href };
      });
    } else if (val.hasOwnProperty('$link')) {
      const link = (val as HalResource).$link;

      if (link.href) {
        halResource.$source._links[linkName] = link;
      }
    } else if ('href' in val) {
      halResource.$source._links[linkName] = { href: val.href };
    }

    if (halResource.$embedded && halResource.$embedded[linkName]) {
      halResource.$embedded[linkName] = val;
      halResource.$source._embedded[linkName] = _.get(val, '$source', val);
    }

    return val;
  }
}
